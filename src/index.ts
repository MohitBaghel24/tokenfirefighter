#!/usr/bin/env node

import process from 'node:process';
import * as http from 'node:http';
import { initConfig, loadConfig } from './config.js';
import { startProxy } from './proxy.js';
import { initDashboard, setupKeyboardInput } from './dashboard.js';
import { initDatabase } from './logger.js';
import { handleReset, handleLogs, handleStatus, handleExport } from './commands.js';

// Importing types just to satisfy the instruction
import { Config, RequestData, LoopResult, SessionState } from './types.js';

const args = process.argv.slice(2);
const command = args[0];

let server: http.Server | null = null;

if (command === 'init') {
  console.log("🧯 TokenFirefighter — initializing...");
  initConfig();
  console.log("Config created at ~/.tokenfirefighter/config.yaml");
  console.log("Next steps:");
  console.log("1. Set OPENAI_API_KEY and ANTHROPIC_API_KEY in your environment");
  console.log("2. Set OPENAI_BASE_URL=http://localhost:7272/v1");
  console.log("3. Run: tokenfirefighter start");
} else if (command === 'start') {
  const config = loadConfig();
  initDatabase(config.logging.db_path);
  
  const isDaemon = args.includes('--daemon');
  if (!isDaemon) {
    console.log("🧯 TokenFirefighter starting on localhost:" + config.server.port);
  }
  
  startProxy(config)
    .then(startedServer => {
      server = startedServer;
      if (!isDaemon) {
        initDashboard();
        setupKeyboardInput(key => {
          if (key === 'quit') {
            server?.close();
            process.exit(0);
          }
          if (key === 'reset') console.log('\nReset not yet implemented via UI');
          if (key === 'pause') console.log('\nPause not yet implemented');
        });
      } else {
        console.log(`🧯 TokenFirefighter running in daemon mode on port ${config.server.port}`);
      }
    })
    .catch(err => {
      console.error("Failed to start proxy:", err);
      process.exit(1);
    });
} else if (command === 'reset') {
  const config = loadConfig();
  handleReset(args, config);
} else if (command === 'logs') {
  const config = loadConfig();
  handleLogs(args, config);
} else if (command === 'status') {
  const config = loadConfig();
  handleStatus(config);
} else if (command === 'export') {
  const config = loadConfig();
  handleExport(args, config);
} else {
  console.log(`Usage: tokenfirefighter <command> [options]

Available commands:
  init           Create default config
  start          Start proxy server
                 --daemon    Run without dashboard
  reset --daily  Reset daily budget
  logs           View recent requests
                 --last N    Number of logs to show
  status         Show system status
  export         Export data
                 --format    csv or json
                 --since     Date string (e.g. 2026-06-01)
                 --out       Output file path
`);
}

process.on('SIGINT', () => {
  console.log(); // Print newline so shell prompt doesn't overwrite current line
  server?.close();
  process.exit(0);
});
