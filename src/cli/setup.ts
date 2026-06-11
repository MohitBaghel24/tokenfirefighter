import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as http from 'node:http';
import * as readline from 'node:readline';
import { configExists, writeDefaultConfig, readConfig, writeConfig } from '../config/manager.js';
import { TOOL_ADAPTERS, getAdapterById } from '../tool-adapters/index.js';
import { TOOL_REGISTRY, ToolEntry } from '../compat/registry.js';
import { runCliCompat } from './compat.js';

// Colored terminal helpers
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans.trim());
  }));
}

function checkProxyHealth(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const options = {
      hostname: host === 'localhost' ? '127.0.0.1' : host,
      port: port,
      path: '/health',
      method: 'GET',
      timeout: 1000
    };
    const req = http.request(options, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => {
      resolve(false);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

export async function runSetup(dryRun: boolean = false) {
  // Display the compatibility registry first as required
  runCliCompat();

  console.log(`\n${BOLD}🧯 TokenFirefighter — Interactive Setup Wizard${RESET}`);
  console.log('--------------------------------------------------');

  // Step 1: Ensure TokenFirefighter's own config exists
  if (!configExists()) {
    if (dryRun) {
      console.log(`${CYAN}[DRY-RUN] Would create default config at ~/.tokenfirefighter/config.yaml${RESET}`);
    } else {
      console.log('No configuration found. Generating standard defaults at ~/.tokenfirefighter/config.yaml...');
      try {
        writeDefaultConfig();
        console.log(`${GREEN}✔ Created TokenFirefighter configuration file.${RESET}`);
      } catch (err: any) {
        console.log(`${RED}✘ Failed to initialize defaults: ${err.message}${RESET}`);
        return;
      }
    }
  }

  // Load configuration to get port/host
  const tfConfig = readConfig() || { proxy: { port: 3456, host: 'localhost' } };
  const port = tfConfig.proxy?.port ?? 3456;
  const host = tfConfig.proxy?.host ?? 'localhost';
  const proxyUrl = `http://${host}:${port}`;

  console.log(`Using TokenFirefighter proxy URL: ${CYAN}${proxyUrl}${RESET}\n`);

  // Step 2: Choose AI tool
  console.log(`${BOLD}Which AI tool are you using?${RESET}`);
  
  // Build options dynamically from TOOL_REGISTRY + Custom
  const options = TOOL_REGISTRY.map(t => ({
    id: t.slug,
    name: t.name,
    support: t.support,
    tool: t
  }));
  
  options.push({
    id: 'custom',
    name: 'Custom (Other)',
    support: 'full',
    tool: {
      name: 'Custom (Other)',
      slug: 'custom',
      support: 'full'
    }
  });

  options.forEach((opt, idx) => {
    let prefix = '✅ ';
    if (opt.support === 'partial') prefix = '⚠️  ';
    if (opt.support === 'none') prefix = '❌ ';
    console.log(`  ${idx + 1}) ${prefix}${opt.name}`);
  });

  const choiceStr = await askQuestion(`\nEnter selection (1-${options.length}): `);
  const choiceIdx = parseInt(choiceStr, 10) - 1;

  if (isNaN(choiceIdx) || choiceIdx < 0 || choiceIdx >= options.length) {
    console.log(`${RED}Invalid selection. Setup cancelled.${RESET}`);
    return;
  }

  const selectedOption = options[choiceIdx];
  const selectedTool = selectedOption.tool;
  console.log(`\nSelected: ${BOLD}${selectedOption.name}${RESET}`);

  // Run compatibility checker guard
  const { runToolCheck } = await import('../tool-adapters/checkers/index.js');
  const { printToolCheckReport } = await import('./check.js');
  
  const report = await runToolCheck(selectedOption.id);
  const compatible = printToolCheckReport(report);

  if (!compatible) {
    console.log(`\n${RED}Refusing to continue setup due to compatibility errors. Please resolve them first.${RESET}\n`);
    return;
  }

  // Handle incompatible tools
  if (selectedOption.support === 'none') {
    console.log(`\n${RED}Sorry, ${selectedOption.name} is not compatible with TokenFirefighter.${RESET}`);
    console.log(`${RED}Reason: ${selectedTool.notes || 'Proprietary endpoint, cannot proxy'}${RESET}\n`);
    return;
  }

  // Handle partially supported tools
  if (selectedOption.support === 'partial') {
    console.log(`\n${YELLOW}⚠ Warning: ${selectedOption.name} is only partially supported.${RESET}`);
    console.log(`${YELLOW}Notes: ${selectedTool.notes || 'Requires manual configuration'}${RESET}`);
    if (selectedTool.setupCommand) {
      console.log(`${YELLOW}Manual configuration instruction: ${selectedTool.setupCommand}${RESET}`);
    }
    
    const confirm = await askQuestion(`\nThis tool requires manual configuration. Proceed anyway? [Y/n]: `);
    if (confirm.toLowerCase() === 'n' || confirm.toLowerCase() === 'no') {
      console.log(`\nSetup cancelled.\n`);
      return;
    }
  }

  const adapter = getAdapterById(selectedOption.id);
  if (!adapter) {
    // If it's a tool without an auto adapter (like partial tools Cursor/Jupyter), print manual configuration instructions and run reachability validation
    console.log(`\n${YELLOW}No automatic configuration adapter is available for ${selectedOption.name}.${RESET}`);
    console.log(`Please follow these manual instructions to configure your tool:`);
    console.log(`  - Target URL / API Base URL: ${CYAN}${proxyUrl}${RESET}`);
    if (selectedTool.notes) {
      console.log(`  - Configuration Notes: ${selectedTool.notes}`);
    }
    if (selectedTool.setupCommand) {
      console.log(`  - Setup Command: ${CYAN}${selectedTool.setupCommand}${RESET}`);
    }
    console.log(`\n${GREEN}✔ Setup guide displayed.${RESET}\n`);
    
    console.log(`${BOLD}Verifying proxy reachability...${RESET}`);
    const isHealthy = await checkProxyHealth(port, host);
    if (isHealthy) {
      console.log(`${GREEN}✔ Proxy is active and reachable at ${proxyUrl}/health${RESET}`);
      console.log(`\n${GREEN}${BOLD}Setup complete! Please configure ${selectedOption.name} with the base URL shown above.${RESET}\n`);
    } else {
      console.log(`${YELLOW}⚠ Warning: The proxy is not running on port ${port} yet.${RESET}`);
      console.log(`${YELLOW}Please run "tokenfirefighter start" (or "npm start") in another terminal to start the proxy.${RESET}\n`);
    }
    return;
  }

  // Step 3: Confirm or prompt for path
  let configPath = '';
  if (selectedOption.id === 'openai-sdk') {
    const inputPath = await askQuestion(`Enter path to your project's .env file (default: ./.env): `);
    configPath = inputPath || './.env';
  } else if (selectedOption.id === 'custom') {
    configPath = await askQuestion(`Enter the configuration file path (e.g. path/to/config.json): `);
    if (!configPath) {
      console.log(`${RED}Path is required for custom config setup. Setup cancelled.${RESET}`);
      return;
    }
  } else if (selectedOption.id !== 'ollama') {
    const defaultPath = adapter.defaultConfigPath();
    const inputPath = await askQuestion(`Confirm config path [${defaultPath}] (press Enter to accept, or type path): `);
    configPath = inputPath || defaultPath;
  }

  // Step 4: Perform update
  let keyPath = 'api_base';
  if (selectedOption.id === 'custom') {
    keyPath = await askQuestion(`Enter config key to update (default: api_base): `) || 'api_base';
  }

  console.log(`\n${BOLD}Applying configuration...${RESET}`);

  let result;
  if (selectedOption.id === 'custom') {
    result = (adapter as any).updateConfig(configPath, proxyUrl, dryRun, { keyPath });
  } else {
    result = adapter.updateConfig(configPath, proxyUrl, dryRun);
  }

  if (result.success) {
    if (dryRun) {
      console.log(`\n${CYAN}[DRY-RUN] ${result.summary}${RESET}`);
    } else {
      console.log(`\n${GREEN}✔ ${result.summary}${RESET}`);
      if (result.backupPath) {
        console.log(`${GREEN}✔ Backup saved to ${result.backupPath}${RESET}`);
      }

      // Save active tool config
      try {
        const configObj = readConfig() || {};
        configObj.active_tool = selectedOption.id;
        writeConfig(configObj);
      } catch (err: any) {
        console.warn(`Failed to write active tool to config: ${err.message}`);
      }

      // Step 4.5: Prompt for API keys
      if (selectedOption.id !== 'ollama') {
        console.log(`\n${BOLD}Now let's set up your API keys:${RESET}`);
        
        const { storeKey } = await import('../config/secrets.js');
        const { askHiddenQuestion } = await import('./keys.js');

        const openAIKey = await askHiddenQuestion('  OpenAI key? (press Enter to skip): ');
        if (openAIKey) {
          storeKey('openai', openAIKey);
          console.log(`  ${GREEN}✔ OpenAI key stored securely.${RESET}`);
        }

        const anthropicKey = await askHiddenQuestion('  Anthropic key? (press Enter to skip): ');
        if (anthropicKey) {
          storeKey('anthropic', anthropicKey);
          console.log(`  ${GREEN}✔ Anthropic key stored securely.${RESET}`);
        }

        const geminiKey = await askHiddenQuestion('  Google (Gemini) key? (press Enter to skip): ');
        if (geminiKey) {
          storeKey('google', geminiKey);
          console.log(`  ${GREEN}✔ Google (Gemini) key stored securely.${RESET}`);
        }

        const mistralKey = await askHiddenQuestion('  Mistral key? (press Enter to skip): ');
        if (mistralKey) {
          storeKey('mistral', mistralKey);
          console.log(`  ${GREEN}✔ Mistral key stored securely.${RESET}`);
        }

        const groqKey = await askHiddenQuestion('  Groq key? (press Enter to skip): ');
        if (groqKey) {
          storeKey('groq', groqKey);
          console.log(`  ${GREEN}✔ Groq key stored securely.${RESET}`);
        }
      }
    }
  } else {
    console.log(`\n${RED}✘ Error: ${result.summary}${RESET}`);
    if (result.error) {
      console.log(`${RED}Details: ${result.error}${RESET}`);
    }
    return;
  }

  // Step 5: Reachability validation check
  console.log(`\n${BOLD}Verifying proxy reachability...${RESET}`);
  const isHealthy = await checkProxyHealth(port, host);
  if (isHealthy) {
    console.log(`${GREEN}✔ Proxy is active and reachable at ${proxyUrl}/health${RESET}`);
    console.log(`\n${GREEN}${BOLD}Done. ${selectedOption.name} is ready. All traffic will go through TokenFirefighter.${RESET}\n`);
  } else {
    console.log(`${YELLOW}⚠ Warning: The proxy is not running on port ${port} yet.${RESET}`);
    console.log(`${YELLOW}Please run "tokenfirefighter start" (or "npm start") in another terminal to start the proxy.${RESET}\n`);
  }
}
