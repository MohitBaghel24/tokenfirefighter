import * as http from 'node:http';
import * as https from 'node:https';
import { URL } from 'node:url';
import { loadConfig } from '../config.js';
import { WebhookPayload } from '../types.js';

function formatMessage(payload: WebhookPayload): string {
  return payload.message;
}

function adaptPayloadForService(url: string, payload: WebhookPayload): unknown {
  if (url.includes('hooks.slack.com')) {
    return { text: formatMessage(payload) };
  }
  if (url.includes('discord.com/api/webhooks')) {
    return { content: formatMessage(payload) };
  }
  return payload; // generic JSON
}

function performPost(parsedUrl: URL, payload: WebhookPayload, attempt: number): void {
  try {
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const bodyStr = JSON.stringify(adaptPayloadForService(parsedUrl.href, payload));

    const options: http.RequestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TokenFirefighter/1.0.0'
      },
      timeout: 10000 // 10-second socket timeout
    };

    const req = client.request(parsedUrl, options, (res) => {
      // Consume response data to free up connection
      res.resume();
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        return;
      }
      handleFailure(parsedUrl, payload, attempt, new Error(`HTTP status code ${res.statusCode}`));
    });

    req.on('error', (err) => {
      handleFailure(parsedUrl, payload, attempt, err);
    });

    req.on('timeout', () => {
      req.destroy();
      handleFailure(parsedUrl, payload, attempt, new Error('Request timeout'));
    });

    req.write(bodyStr);
    req.end();
  } catch (err) {
    handleFailure(
      parsedUrl,
      payload,
      attempt,
      err instanceof Error ? err : new Error(String(err))
    );
  }
}

function handleFailure(parsedUrl: URL, payload: WebhookPayload, attempt: number, error: Error): void {
  if (attempt === 1) {
    // Retry exactly once after a 2-second delay
    setTimeout(() => {
      performPost(parsedUrl, payload, 2);
    }, 2000);
  } else {
    // Silently drop and log failure to stdout
    console.log(`[ALERT] Webhook failed after retry, dropping: ${parsedUrl.href}`);
  }
}

export function sendWebhookAlert(payload: WebhookPayload): void {
  try {
    const config = loadConfig();
    const alerts = config.alerts;
    if (!alerts) {
      return;
    }

    const urlStr = alerts.webhook_url;
    if (!urlStr || typeof urlStr !== 'string' || urlStr.trim() === '') {
      return;
    }

    if (payload.event === 'loop_detected' && alerts.on_loop_detected === false) {
      return;
    }

    if (payload.event === 'budget_exceeded' && alerts.on_budget_exceeded === false) {
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(urlStr);
    } catch {
      console.error('[ALERT] Invalid webhook_url in config, skipping.');
      return;
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return;
    }

    // Fire-and-forget: execute request asynchronously
    performPost(parsedUrl, payload, 1);
  } catch (error) {
    // Ensure we never throw an exception from this function
  }
}
