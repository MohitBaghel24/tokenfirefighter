#!/usr/bin/env node

import process from 'node:process';
import * as http from 'node:http';
import { loadConfig } from '../config.js';
import { startProxy } from '../proxy.js';
import { initDashboard, setupKeyboardInput } from '../dashboard.js';
import { initDatabase } from '../logger.js';
import { handleReset, handleLogs, handleStatus, handleExport, handleDashboard } from '../commands.js';
import { runSetup } from './setup.js';
import { runCliDoctor } from './doctor.js';
import { runCliCompat } from './compat.js';
import { configExists } from '../config/manager.js';

const args = process.argv.slice(2);
const command = args[0];

if (command === 'setup') {
  const dryRun = args.includes('--dry-run');
  const toolSlug = args.filter(arg => arg !== 'setup' && !arg.startsWith('--'))[0];
  runSetup(dryRun, toolSlug)
    .then(() => {
      process.exit(0);
    })
    .catch(err => {
      console.error('Setup wizard error:', err);
      process.exit(1);
    });
} else if (command === 'doctor') {
  if (!configExists()) {
    console.log('\n\x1b[33m🧯 TokenFirefighter has not been set up on this device yet.\x1b[0m');
    console.log('Please run: \x1b[36mtokenfirefighter setup\x1b[0m (or node dist/cli/index.js setup) to configure your proxy and tools.\n');
    process.exit(0);
  }
  runCliDoctor()
    .then(() => {
      process.exit(0);
    })
    .catch(err => {
      console.error('Doctor command error:', err);
      process.exit(1);
    });
} else if (command === 'compat') {
  runCliCompat();
  process.exit(0);
} else if (command === 'check') {
  const { runCliCheck } = await import('./check.js');
  runCliCheck(args)
    .then(() => {
      process.exit(0);
    })
    .catch(err => {
      console.error('Check command error:', err);
      process.exit(1);
    });
} else if (command === 'config' && args[1] === 'keys') {
  const { runCliKeys } = await import('./keys.js');
  runCliKeys(args)
    .then(() => {
      process.exit(0);
    })
    .catch(err => {
      console.error('Keys manager command error:', err);
      process.exit(1);
    });
} else {
  // First-time UX check
  if (!configExists()) {
    console.log('\n\x1b[33m🧯 TokenFirefighter has not been set up on this device yet.\x1b[0m');
    console.log('Please run: \x1b[36mtokenfirefighter setup\x1b[0m (or node dist/cli/index.js setup) to configure your proxy and tools.\n');
    process.exit(0);
  }

  const config = loadConfig();

  if (command === 'start') {
    initDatabase(config.logging.db_path);
    const isDaemon = args.includes('--daemon');
    const isWeb = args.includes('--web');
    if (!isDaemon) {
      console.log("🧯 TokenFirefighter starting on localhost:" + config.server.port);
    }
    
    let server: http.Server | null = null;
    startProxy(config)
      .then(async startedServer => {
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

        if (isWeb) {
          console.log(`Dashboard: http://localhost:${config.server.port}/dashboard`);
          const { default: open } = await import('open');
          await open(`http://localhost:${config.server.port}/dashboard`);
        }
      })
      .catch(err => {
        console.error("Failed to start proxy:", err);
        process.exit(1);
      });

    process.on('SIGINT', () => {
      console.log();
      server?.close();
      process.exit(0);
    });
  } else if (command === 'reset') {
    handleReset(args, config);
  } else if (command === 'logs') {
    handleLogs(args, config);
  } else if (command === 'status') {
    handleStatus(config);
  } else if (command === 'export') {
    handleExport(args, config);
  } else if (command === 'dashboard') {
    handleDashboard(config);
  } else {
    console.log(`Usage: tokenfirefighter <command> [options]

Available commands:
  setup          Launch the interactive setup wizard
                 --dry-run   Show changes without modifying files
  compat         Show tool compatibility registry
  check          Verify compatibility of local AI tools (e.g. check kimchi)
  doctor         Run connection diagnostics
  config keys    Manage stored API keys (--show, --remove-<provider>)
  start          Start proxy server
                 --daemon    Run without dashboard
                 --web       Open the Web Dashboard in your browser
  dashboard      Open the Web Dashboard directly
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
}
