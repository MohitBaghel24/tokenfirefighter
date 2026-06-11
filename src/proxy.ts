import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import * as crypto from 'crypto';
import { Config, RequestData, LoopResult, SessionState, RouteResult } from './types.js';
import { loadConfig } from './config.js';
import { calculateCost, normalizeModelName } from './pricing.js';
import { initDatabase, logRequest, updateSessionCost, logSessionStart } from './logger.js';
import { checkBudget, getBudgetStatus } from './budget.js';
import { checkExactSignature, createSignature, addSignature } from './loop-l1.js';
import { checkTokenTrajectory, addTokenCount } from './loop-l2.js';
import { checkContentSimilarity, addBody } from './loop-l3.js';
import { checkErrorRetryStorm, addError } from './loop-l4.js';
import { detectProvider } from './adapters/index.js';
import { serveDashboard, handleApi, handleSSE, broadcastEvent, addAlert } from './dashboard-web.js';
import { initDb, recordRequest } from './db/requests.js';
import { startFirstRunTimer, markRequestReceived } from './proxy/firstRunWatcher.js';
import { loadSecrets } from './config/secrets.js';
import { sendWebhookAlert } from './alerts/webhook.js';

const sessions = new Map<string, SessionState>();

function getSession(sessionId: string): SessionState {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      id: sessionId,
      createdAt: new Date(),
      lastCallAt: new Date(),
      dailySpend: 0,
      sessionSpend: 0,
      callCount: 0,
      recentSignatures: [],
      recentTokenCounts: [],
      recentBodies: [],
      recentErrors: [],
      lastCallStatus: 'ok'
    });
    logSessionStart(sessionId);
  }
  return sessions.get(sessionId)!;
}

export function createProxy(config: Config): http.Server {
  return http.createServer((req, res) => {
    const startTime = Date.now();
    let bodyBuffer = Buffer.alloc(0);

    req.on('data', chunk => {
      bodyBuffer = Buffer.concat([bodyBuffer, chunk]);
    });

    req.on('end', () => {
      handleRequest(req, res, bodyBuffer, config, startTime).catch(err => {
        console.error('Proxy error:', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal proxy error' }));
        }
      });
    });
  });
}

async function handleRequest(
  req: http.IncomingMessage, 
  res: http.ServerResponse, 
  bodyBuffer: Buffer, 
  config: Config,
  startTime: number
) {
  const method = req.method || 'GET';
  const urlPath = req.url || '/';

  // Intercept dashboard and API routes
  if (method === 'GET' && urlPath === '/dashboard') {
    serveDashboard(res);
    return;
  }
  if (method === 'GET' && urlPath === '/api/events') {
    handleSSE(req, res);
    return;
  }
  if (method === 'GET' && (urlPath === '/health' || urlPath === '/api/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', version: '1.0.0' }));
    return;
  }
  if (urlPath.startsWith('/api/')) {
    handleApi(req, res, urlPath, config, sessions);
    return;
  }

  // Mark first request received
  const toolDetected = detectTool(req.headers as Record<string, string | string[] | undefined>, urlPath);
  markRequestReceived(toolDetected, urlPath);

  // Identify provider using adapters
  const adapter = detectProvider(urlPath, req.headers as Record<string, string>);
  const detectedProvider = detectTargetProviderName(req, urlPath);
  let providerName = detectedProvider;

  let providerConfig = config.providers[providerName];
  let targetUrlStr = '';

  // Fallback priority for API keys
  const inboundKey = extractInboundApiKey(req, urlPath);
  let resolvedKey: string | null = null;

  if (inboundKey && !isPlaceholderKey(inboundKey)) {
    resolvedKey = inboundKey;
  } else {
    // Check secrets
    const secrets = loadSecrets();
    const secretKeyName = providerName === 'gemini' ? 'google' : providerName;
    if (secrets[secretKeyName]) {
      resolvedKey = secrets[secretKeyName];
    } else {
      // Check env
      const envKeys = PROVIDER_ENV_MAP[secretKeyName] || [];
      for (const envKey of envKeys) {
        if (process.env[envKey]) {
          resolvedKey = process.env[envKey]!;
          break;
        }
      }
    }
  }

  // If no key is found for a detected provider, return 401 or 500
  if (!resolvedKey && providerName !== 'local' && providerName !== 'generic') {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: `No API key configured for ${getProviderDisplayName(providerName)}. Run: tokenfirefighter config keys`
    }));
    return;
  }

  if (!providerConfig || !providerConfig.enabled) {
    const customTarget = req.headers['x-tokenfirefighter-target'] as string;
    if (customTarget) {
      providerName = 'generic'; // Fallback for stats tracking
      providerConfig = {
        api_key: resolvedKey || '',
        base_url: customTarget,
        enabled: true
      };
      let baseUrl = customTarget;
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
      targetUrlStr = baseUrl + urlPath;
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Provider ${detectedProvider} not found or disabled, and no X-TokenFirefighter-Target header provided.` }));
      return;
    }
  } else {
    // Clone config to avoid modifying global settings
    providerConfig = {
      ...providerConfig,
      api_key: resolvedKey || ''
    };

    let baseUrl = providerConfig.base_url;
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    targetUrlStr = baseUrl + urlPath;
    
    // Gemini special handling
    if (providerName === 'gemini' && providerConfig.api_key) {
      let cleanUrlPath = urlPath;
      if (cleanUrlPath.includes('key=')) {
        cleanUrlPath = cleanUrlPath.replace(/[?&]key=[^&]+/g, '');
        if (cleanUrlPath.endsWith('?') || cleanUrlPath.endsWith('&')) {
          cleanUrlPath = cleanUrlPath.slice(0, -1);
        }
      }
      const sep = cleanUrlPath.includes('?') ? '&' : '?';
      targetUrlStr = baseUrl + cleanUrlPath + `${sep}key=${providerConfig.api_key}`;
    }
  }

  // Extract Session ID
  let sessionId = req.headers['x-tokenfirefighter-session'] as string;
  if (!sessionId) {
    const authHeader = req.headers['authorization'] || req.headers['x-api-key'] || '';
    sessionId = crypto.createHash('sha256').update(authHeader as string).digest('hex').substring(0, 8);
  }

  const session = getSession(sessionId);
  
  // Parse body if JSON
  let parsedBody: any = {};
  if (bodyBuffer.length > 0) {
    try {
      parsedBody = JSON.parse(bodyBuffer.toString('utf8'));
    } catch (e) {
      // Not a JSON body or malformed
    }
  }

  // Extract model using adapter
  let rawModel = adapter.extractModel(parsedBody);
  let model = normalizeModelName(rawModel);

  // Layer 1 Loop Detection (Exact Signature)
  const signature = createSignature(urlPath, method, bodyBuffer);
  const currentTokensEst = Math.ceil(bodyBuffer.length / 4);
  const bodyString = bodyBuffer.toString('utf8');
  
  if (config.loop_detection.enabled) {
    const loopResult = checkExactSignature(session, signature, config.loop_detection);
    if (loopResult.detected && loopResult.action === 'block') {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: {
          type: 'loop_detected',
          layer: loopResult.layer,
          message: loopResult.reason,
          estimated_savings_usd: loopResult.estimated_savings_usd
        }
      }));
      const reasonStr = loopResult.reason || 'Loop detected';
      addAlert({ id: crypto.randomUUID(), type: 'loop_alert', severity: 'critical', message: reasonStr, timestamp: Date.now() });
      broadcastEvent({ type: 'loop_alert', data: { layer: loopResult.layer, reason: reasonStr } });

      sendWebhookAlert({
        event: "loop_detected",
        message: `Runaway loop detected and blocked. ${loopResult.calls_in_loop || 0} requests in ${config.loop_detection.exact_signature_window_seconds}s from ${toolDetected || 'Unknown Tool'} → ${getProviderDisplayName(providerName)}.`,
        estimated_savings_usd: loopResult.estimated_savings_usd || 0,
        current_spend_usd: getBudgetStatus(sessionId).dailySpend,
        layer: 1,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Layer 2 Token Trajectory
    const l2Result = checkTokenTrajectory(session, currentTokensEst, config.loop_detection);
    if (l2Result.detected) {
      session.lastCallStatus = 'warning';
    } else {
      session.lastCallStatus = 'ok';
    }

    // Layer 3 Content Similarity
    if (session.lastCallStatus === 'warning') {
      const l3Result = checkContentSimilarity(session, bodyString, config.loop_detection);
      if (l3Result.detected && l3Result.action === 'block') {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: {
            type: 'loop_detected',
            layer: l3Result.layer,
            message: l3Result.reason
          }
        }));
        const reasonStr = l3Result.reason || 'Content similarity loop detected';
        addAlert({ id: crypto.randomUUID(), type: 'loop_alert', severity: 'critical', message: reasonStr, timestamp: Date.now() });
        broadcastEvent({ type: 'loop_alert', data: { layer: l3Result.layer, reason: reasonStr } });

        sendWebhookAlert({
          event: "loop_detected",
          message: `Runaway loop detected and blocked. Content similarity >= ${config.loop_detection.content_similarity_threshold} for last ${config.loop_detection.content_similarity_consecutive_calls} consecutive calls from ${toolDetected || 'Unknown Tool'} → ${getProviderDisplayName(providerName)}.`,
          estimated_savings_usd: 0,
          current_spend_usd: getBudgetStatus(sessionId).dailySpend,
          layer: 3,
          timestamp: new Date().toISOString(),
        });
        return;
      }
    }
  }

  // Budget check before forwarding
  const budgetResult = checkBudget(sessionId, 0, config.budget);
  if (!budgetResult.allowed) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: {
        type: 'budget_exceeded',
        reason: budgetResult.reason,
        current_spend_usd: budgetResult.current_spend_usd,
        limit_usd: budgetResult.limit_usd
      }
    }));
    // Note: checkBudget already emits budget_alert internally
    if (budgetResult.reason?.includes('Daily budget')) {
      sendWebhookAlert({
        event: "budget_exceeded",
        message: `Daily budget exceeded ($${budgetResult.current_spend_usd.toFixed(2)} / $${budgetResult.limit_usd.toFixed(2)}). Further requests are blocked until tomorrow.`,
        current_spend_usd: budgetResult.current_spend_usd,
        budget_limit_usd: budgetResult.limit_usd,
        timestamp: new Date().toISOString(),
      });
    }
    return;
  }

  // Update State Tracking
  addSignature(session, signature);
  addTokenCount(session, currentTokensEst);
  addBody(session, bodyString);

  // Target routing
  const targetUrl = new URL(targetUrlStr);
  const headers = { ...req.headers };
  headers['host'] = targetUrl.host;
  
  // Apply adapter auth headers (overwrites)
  delete headers['authorization'];
  delete headers['x-api-key'];
  delete headers['Authorization'];
  delete headers['X-API-Key'];
  
  const authHeaders = adapter.getAuthHeaders(providerConfig.api_key);
  for (const [k, v] of Object.entries(authHeaders)) {
    if (v) headers[k] = v;
  }
  
  // Clean up unused headers based on provider
  if (providerName === 'anthropic' || providerName === 'gemini') {
    delete headers['authorization']; 
  }

  const options: https.RequestOptions = {
    method: method,
    headers: headers,
    timeout: config.server.request_timeout_ms
  };

  const providerReq = https.request(targetUrl, options, (providerRes) => {
    // LAYER 4 Error Check
    if (providerRes.statusCode && providerRes.statusCode >= 400) {
      if (config.loop_detection.enabled) {
        const l4Result = checkErrorRetryStorm(session, providerRes.statusCode, providerName, config.loop_detection);
        if (l4Result.detected && l4Result.action === 'block') {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: {
              type: 'loop_detected',
              layer: l4Result.layer,
              message: l4Result.reason
            }
          }));
          const reasonStr = l4Result.reason || 'Error retry storm detected';
          addError(session, providerRes.statusCode, providerName);
          addAlert({ id: crypto.randomUUID(), type: 'loop_alert', severity: 'critical', message: reasonStr, timestamp: Date.now() });
          broadcastEvent({ type: 'loop_alert', data: { layer: l4Result.layer, reason: reasonStr } });

          sendWebhookAlert({
            event: "loop_detected",
            message: `Runaway loop detected and blocked. Error retry storm: Tool '${toolDetected || 'Unknown Tool'}' errored with status ${providerRes.statusCode} repeated ${config.loop_detection.tool_error_retry_threshold} times within ${config.loop_detection.tool_error_retry_window_seconds}s.`,
            estimated_savings_usd: 0,
            current_spend_usd: getBudgetStatus(sessionId).dailySpend,
            layer: 4,
            timestamp: new Date().toISOString(),
          });
          return; // Skip streaming back the error
        }
      }
      addError(session, providerRes.statusCode, providerName);
    }

    // Stream directly back to client (supports SSE natively)
    res.writeHead(providerRes.statusCode || 200, providerRes.headers);
    providerRes.pipe(res);

    // Concurrently buffer response to calculate cost
    let resBodyBuffer = Buffer.alloc(0);
    providerRes.on('data', chunk => {
      resBodyBuffer = Buffer.concat([resBodyBuffer, chunk]);
    });

    providerRes.on('end', () => {
      const durationMs = Date.now() - startTime;
      let inputTokens = 0;
      let outputTokens = 0;
      let responseBodyStr = resBodyBuffer.toString('utf8');

      // Attempt to extract usage stats via adapter
      let usageData = null;
      try {
        const json = JSON.parse(responseBodyStr);
        usageData = adapter.extractUsage(json, responseBodyStr);
      } catch (e) {
        usageData = adapter.extractUsage(null, responseBodyStr);
      }

      if (usageData) {
        inputTokens = usageData.inputTokens;
        outputTokens = usageData.outputTokens;
      } else if (adapter.supportsByteEstimation) {
        // Fallback estimation
        const estimatedTokens = Math.ceil(resBodyBuffer.length / 4);
        outputTokens = estimatedTokens;
      }

      const cost = calculateCost(model, inputTokens, outputTokens);

      const requestData: RequestData = {
        id: crypto.randomUUID(),
        timestamp: startTime,
        request_id: crypto.randomUUID(),
        session_id: sessionId,
        provider: providerName,
        model: model,
        endpoint: urlPath,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: cost,
        loop_status: 'ok',
        blocked: false,
        duration_ms: durationMs,
        http_status: providerRes.statusCode || 200
      };

      logRequest(requestData);
      const toolDetected = detectTool(req.headers as Record<string, string | string[] | undefined>, urlPath);
      recordRequest({
        timestamp: startTime,
        tool: toolDetected,
        model: model,
        tokens_used: inputTokens + outputTokens,
        cost_usd: cost
      });
      if (cost > 0) {
        updateSessionCost(sessionId, cost);
        checkBudget(sessionId, cost, config.budget); // Apply actual cost to limit
      }
      
      session.callCount += 1;
      session.sessionSpend += cost;
      session.lastCallAt = new Date();
      
      broadcastEvent({ 
        type: 'call_complete', 
        data: { 
          provider: providerName, 
          model,       
          cost_usd: cost, 
          blocked: false, 
          http_status: providerRes.statusCode || 200 
        } 
      });
    });
  });

  providerReq.on('error', (err) => {
    console.error('Provider request error:', err);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad Gateway', details: err.message }));
    }
  });

  providerReq.on('timeout', () => {
    providerReq.destroy();
    if (!res.headersSent) {
      res.writeHead(504, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Gateway Timeout' }));
    }
  });

  providerReq.write(bodyBuffer);
  providerReq.end();
}

function detectTool(headers: Record<string, string | string[] | undefined>, urlPath: string): string | null {
  const userAgent = (headers['user-agent'] as string || '').toLowerCase();
  
  if (userAgent.includes('claude-cli') || userAgent.includes('claude-code')) {
    return 'Claude Code';
  }
  if (userAgent.includes('openai-node') || userAgent.includes('openai-python')) {
    return 'OpenAI SDK';
  }
  if (userAgent.includes('continue')) {
    return 'Continue.dev';
  }
  if (userAgent.includes('kimchi')) {
    return 'Kimchi';
  }
  if (userAgent.includes('opencode')) {
    return 'OpenCode';
  }
  if (userAgent.includes('ollama')) {
    return 'Ollama';
  }
  
  if (headers['x-continue-version']) return 'Continue.dev';
  if (headers['x-claude-cli-version']) return 'Claude Code';
  
  return null;
}

const PROVIDER_ENV_MAP: Record<string, string[]> = {
  openai: ['OPENAI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
  google: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  mistral: ['MISTRAL_API_KEY'],
  groq: ['GROQ_API_KEY']
};

export function detectTargetProviderName(req: http.IncomingMessage, urlPath: string): string {
  // Check x-tokenfirefighter-target domain
  const customTarget = req.headers['x-tokenfirefighter-target'] as string;
  if (customTarget) {
    const host = customTarget.toLowerCase();
    if (host.includes('openai.com')) return 'openai';
    if (host.includes('anthropic.com')) return 'anthropic';
    if (host.includes('googleapis.com') || host.includes('google.com')) return 'gemini';
    if (host.includes('mistral.ai') || host.includes('mistral')) return 'mistral';
    if (host.includes('groq.com') || host.includes('groq')) return 'groq';
  }

  // Check request path
  if (urlPath.startsWith('/v1/messages')) return 'anthropic';
  if (urlPath.startsWith('/v1beta/models') || urlPath.includes('generativelanguage')) return 'gemini';
  if (urlPath.startsWith('/v1/chat/completions') || urlPath.startsWith('/v1/completions') || urlPath.startsWith('/v1/embeddings')) {
    const auth = (req.headers['authorization'] as string || '').toLowerCase();
    const apiKey = (req.headers['x-api-key'] as string || '').toLowerCase();
    if (auth.startsWith('bearer gsk_') || apiKey.startsWith('gsk_')) return 'groq';
    return 'openai';
  }

  const adapter = detectProvider(urlPath, req.headers as Record<string, string>);
  return adapter.name === 'gemini' ? 'gemini' : adapter.name;
}

export function extractInboundApiKey(req: http.IncomingMessage, urlPath: string): string | null {
  const auth = req.headers['authorization'] as string | undefined;
  if (auth) {
    return auth.replace(/^Bearer\s+/i, '').trim();
  }
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (apiKey) {
    return apiKey.trim();
  }
  if (urlPath.includes('key=')) {
    const match = urlPath.match(/[?&]key=([^&]+)/);
    if (match) {
      return match[1];
    }
  }
  return null;
}

export function isPlaceholderKey(key: string): boolean {
  const k = key.toLowerCase();
  return k === '' || k.includes('placeholder') || k.includes('dummy') || k.startsWith('tf-');
}

export function getProviderDisplayName(name: string): string {
  const displayNames: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    gemini: 'Google (Gemini)',
    google: 'Google (Gemini)',
    mistral: 'Mistral',
    groq: 'Groq'
  };
  return displayNames[name.toLowerCase()] || name;
}

export function startProxy(config: Config): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    try {
      initDb();
      const server = createProxy(config);
      server.listen(config.server.port, config.server.host, () => {
        startFirstRunTimer(config.server.port);
        resolve(server);
      });
    } catch (err) {
      reject(err);
    }
  });
}
