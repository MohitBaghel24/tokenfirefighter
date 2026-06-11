import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as http from 'node:http';
import { loadConfig, CONFIG_PATH } from '../config.js';
import { sendWebhookAlert } from '../alerts/webhook.js';

describe('webhook alert system', () => {
  let originalContent = '';
  let originalExists = false;

  before(() => {
    originalExists = fs.existsSync(CONFIG_PATH);
    if (originalExists) {
      originalContent = fs.readFileSync(CONFIG_PATH, 'utf8');
    }
  });

  after(() => {
    if (originalExists) {
      fs.writeFileSync(CONFIG_PATH, originalContent, 'utf8');
    } else if (fs.existsSync(CONFIG_PATH)) {
      fs.unlinkSync(CONFIG_PATH);
    }
  });

  test('sends generic JSON alert to webhook URL', () => {
    return new Promise<void>((resolve, reject) => {
      let receivedPayload: any = null;

      const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            receivedPayload = JSON.parse(body);
          } catch (e) {}
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('ok');
        });
      });

      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as any;
        const port = address.port;
        const url = `http://127.0.0.1:${port}`;

        const testConfig = `
alerts:
  webhook_url: "${url}"
  on_loop_detected: true
  on_budget_exceeded: true
`;
        fs.writeFileSync(CONFIG_PATH, testConfig, 'utf8');

        sendWebhookAlert({
          event: 'loop_detected',
          message: 'Test runaway loop alert',
          estimated_savings_usd: 5.0,
          current_spend_usd: 1.23,
          layer: 1,
          timestamp: '2026-06-11T12:00:00Z'
        });

        setTimeout(() => {
          server.close();
          try {
            assert.ok(receivedPayload);
            assert.strictEqual(receivedPayload.event, 'loop_detected');
            assert.strictEqual(receivedPayload.message, 'Test runaway loop alert');
            assert.strictEqual(receivedPayload.estimated_savings_usd, 5.0);
            assert.strictEqual(receivedPayload.current_spend_usd, 1.23);
            assert.strictEqual(receivedPayload.layer, 1);
            assert.strictEqual(receivedPayload.timestamp, '2026-06-11T12:00:00Z');
            resolve();
          } catch (err) {
            reject(err);
          }
        }, 500);
      });
    });
  });

  test('adapts payload for Slack webhook URLs', () => {
    return new Promise<void>((resolve, reject) => {
      let receivedPayload: any = null;

      const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            receivedPayload = JSON.parse(body);
          } catch (e) {}
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('ok');
        });
      });

      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as any;
        const port = address.port;
        // Slack webhook URL matches target check in code
        const url = `http://127.0.0.1:${port}/hooks.slack.com/services/test`;

        const testConfig = `
alerts:
  webhook_url: "${url}"
  on_loop_detected: true
  on_budget_exceeded: true
`;
        fs.writeFileSync(CONFIG_PATH, testConfig, 'utf8');

        sendWebhookAlert({
          event: 'budget_exceeded',
          message: 'Test budget warning alert',
          current_spend_usd: 10.0,
          budget_limit_usd: 5.0,
          timestamp: '2026-06-11T12:00:00Z'
        });

        setTimeout(() => {
          server.close();
          try {
            assert.ok(receivedPayload);
            assert.strictEqual(receivedPayload.text, 'Test budget warning alert');
            assert.strictEqual(receivedPayload.event, undefined);
            resolve();
          } catch (err) {
            reject(err);
          }
        }, 500);
      });
    });
  });

  test('respects disabled event preferences', () => {
    return new Promise<void>((resolve, reject) => {
      let receivedCount = 0;

      const server = http.createServer((req, res) => {
        receivedCount++;
        res.writeHead(200);
        res.end();
      });

      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as any;
        const port = address.port;
        const url = `http://127.0.0.1:${port}`;

        const testConfig = `
alerts:
  webhook_url: "${url}"
  on_loop_detected: false
  on_budget_exceeded: true
`;
        fs.writeFileSync(CONFIG_PATH, testConfig, 'utf8');

        sendWebhookAlert({
          event: 'loop_detected',
          message: 'Should be skipped',
          timestamp: '2026-06-11T12:00:00Z'
        });

        setTimeout(() => {
          server.close();
          try {
            assert.strictEqual(receivedCount, 0);
            resolve();
          } catch (err) {
            reject(err);
          }
        }, 500);
      });
    });
  });
});
