import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import * as crypto from 'crypto';
import { Config, RequestData, LoopResult, SessionState, RouteResult } from './types.js';
import { loadConfig } from './config.js';
import { calculateCost, normalizeModelName } from './pricing.js';
import { initDatabase, logRequest, updateSessionCost, logSessionStart } from './logger.js';
import { checkBudget } from './budget.js';
import { checkExactSignature, createSignature, addSignature } from './loop-l1.js';
import { checkTokenTrajectory, addTokenCount } from './loop-l2.js';
import { checkContentSimilarity, addBody } from './loop-l3.js';
import { checkErrorRetryStorm, addError } from './loop-l4.js';
import { detectProvider } from './adapters/index.js';

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

  // Identify provider using adapters
  const adapter = detectProvider(urlPath, req.headers as Record<string, string>);
  let providerName = adapter.name;

  let providerConfig = config.providers[providerName];
  let targetUrlStr = '';

  if (!providerConfig || !providerConfig.enabled) {
    const customTarget = req.headers['x-tokenfirefighter-target'] as string;
    if (customTarget) {
      providerName = 'generic'; // Fallback for stats tracking
      const apiKey = req.headers['authorization']?.toString().replace('Bearer ', '') || req.headers['x-api-key']?.toString() || '';
      providerConfig = {
        api_key: apiKey,
        base_url: customTarget,
        enabled: true
      };
      let baseUrl = customTarget;
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
      targetUrlStr = baseUrl + urlPath;
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Provider ${providerName} not found or disabled, and no X-TokenFirefighter-Target header provided.` }));
      return;
    }
  } else {
    let baseUrl = providerConfig.base_url;
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    targetUrlStr = baseUrl + urlPath;
    
    // Gemini special handling
    if (providerName === 'gemini' && providerConfig.api_key) {
      const sep = targetUrlStr.includes('?') ? '&' : '?';
      targetUrlStr += `${sep}key=${providerConfig.api_key}`;
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
          addError(session, providerRes.statusCode, providerName);
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
      if (cost > 0) {
        updateSessionCost(sessionId, cost);
        checkBudget(sessionId, cost, config.budget); // Apply actual cost to limit
      }
      
      session.callCount += 1;
      session.sessionSpend += cost;
      session.lastCallAt = new Date();
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

export function startProxy(config: Config): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    try {
      const server = createProxy(config);
      server.listen(config.server.port, config.server.host, () => {
        console.log(`TokenFirefighter proxy listening on ${config.server.host}:${config.server.port}`);
        resolve(server);
      });
    } catch (err) {
      reject(err);
    }
  });
}
