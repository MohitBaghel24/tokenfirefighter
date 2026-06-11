/**
 * TokenFirefighter — Interactive Setup Wizard
 *
 * Guides beginners through:
 * 1. Choosing their AI tool
 * 2. Entering API keys interactively
 * 3. Writing config with keys (optional) or env-var instructions
 * 4. Printing tool-specific next steps
 */

import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { CONFIG_DIR, CONFIG_PATH, DEFAULT_CONFIG, loadConfig } from './config.js';
import { TOOLS, getToolById } from './compatibility.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve));
}

function askYesNo(question: string): Promise<boolean> {
  return new Promise(async resolve => {
    const answer = (await ask(question + ' (y/n): ')).trim().toLowerCase();
    resolve(answer === 'y' || answer === 'yes');
  });
}

function maskInput(input: string): string {
  if (input.length <= 8) return '****';
  return input.slice(0, 4) + '****' + input.slice(-4);
}

export async function runSetupWizard(): Promise<void> {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║               🧯 TokenFirefighter — Interactive Setup Wizard                 ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Step 1: Choose tool
  console.log('Which AI tool are you using?');
  console.log('');
  const fullTools = TOOLS.filter(t => t.supported === 'full' || t.supported === 'partial');
  fullTools.forEach((t, i) => {
    const marker = t.supported === 'full' ? '✅' : '⚠️';
    console.log(`  ${i + 1}. ${marker} ${t.name}`);
  });
  console.log(`  ${fullTools.length + 1}. ❌ My tool is not listed`);
  console.log('');

  let choice = parseInt(await ask('Enter number: '), 10);
  if (isNaN(choice) || choice < 1 || choice > fullTools.length + 1) {
    console.log('Invalid choice. Exiting setup.');
    rl.close();
    return;
  }

  if (choice === fullTools.length + 1) {
    console.log('');
    console.log('Your tool may still work if it supports setting a custom API base URL.');
    console.log('Look for a setting called "base_url", "api_base", or "endpoint" in your tool.');
    console.log('Set it to: http://localhost:7272/v1');
    console.log('');
    console.log('Run "tokenfirefighter tools" to see the full compatibility list.');
    rl.close();
    return;
  }

  const selectedTool = fullTools[choice - 1];
  console.log('');
  console.log(`You selected: ${selectedTool.name}`);
  console.log('');

  // Step 2: API Key setup
  console.log('--- API Key Setup ---');
  console.log('TokenFirefighter needs your API key to forward requests to the real provider.');
  console.log('');

  const storeInConfig = await askYesNo('Do you want to store your API key in the config file?\n  (If NO, you must set it as an environment variable yourself)');

  let apiKey = '';
  const providerId = selectedTool.provider === 'multiple' ? 'openai' : selectedTool.provider;

  if (storeInConfig) {
    apiKey = (await ask(`Enter your ${providerId.toUpperCase()} API key: `)).trim();
    if (!apiKey) {
      console.log('No key entered. You can add it later by running "tokenfirefighter setup" again.');
    } else {
      console.log(`Key stored: ${maskInput(apiKey)}`);
    }
  } else {
    console.log('');
    console.log('Please set this environment variable in your shell profile:');
    const envVarName = providerId === 'anthropic' ? 'ANTHROPIC_API_KEY' : providerId === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
    console.log(`  export ${envVarName}=your-key-here`);
    console.log('');
    console.log(`Then run: source ~/.${os.userInfo().shell?.split('/').pop() || 'zsh'}rc`);
    console.log('');
  }

  // Step 3: Write config
  console.log('--- Saving Configuration ---');

  let config: any = loadConfig();
  if (!fs.existsSync(CONFIG_PATH)) {
    config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  // Update provider key if stored
  if (storeInConfig && apiKey && config.providers[providerId]) {
    config.providers[providerId].api_key = apiKey;
  }

  // Enable the provider
  if (config.providers[providerId]) {
    config.providers[providerId].enabled = true;
  }

  // Write updated config
  const yaml = await import('js-yaml');
  fs.writeFileSync(CONFIG_PATH, yaml.dump(config), 'utf8');
  console.log(`Config saved to: ${CONFIG_PATH}`);
  console.log('');

  // Step 4: Print tool-specific setup instructions
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log(`║  Setup for: ${selectedTool.name.padEnd(63)}║`);
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');

  for (const step of selectedTool.setupSteps) {
    const lines = wrapLine(`  • ${step}`, 76);
    for (const line of lines) {
      console.log('║' + line.padEnd(78) + '║');
    }
  }

  if (Object.keys(selectedTool.envVars).length > 0) {
    console.log('║                                                                              ║');
    console.log('║  Required environment variables:                                             ║');
    for (const [key, val] of Object.entries(selectedTool.envVars)) {
      const line = `    export ${key}=${val}`;
      console.log('║' + line.padEnd(78) + '║');
    }
  }

  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Step 5: Shell profile helper (if env vars needed and not storing in config)
  if (!storeInConfig) {
    const shell = process.env.SHELL || '/bin/zsh';
    const profileFile = shell.includes('bash') ? '.bashrc' : '.zshrc';
    const profilePath = path.join(os.homedir(), profileFile);

    const autoWrite = await askYesNo(`Would you like me to append the export line to ~/${profileFile}?`);
    if (autoWrite) {
      const envVarName = providerId === 'anthropic' ? 'ANTHROPIC_API_KEY' : providerId === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
      const exportLine = `\n# TokenFirefighter proxy config\nexport ${envVarName}=\nexport ${providerId === 'openai' ? 'OPENAI_BASE_URL' : providerId === 'anthropic' ? 'ANTHROPIC_BASE_URL' : 'GEMINI_BASE_URL'}=http://localhost:7272/v1\n`;
      fs.appendFileSync(profilePath, exportLine);
      console.log(`Added proxy exports to ${profilePath}`);
      console.log('Please edit the file to add your actual API key value.');
      console.log(`Then run: source ~/${profileFile}`);
    }
  }

  console.log('');
  console.log('Next steps:');
  console.log('  1. Run: tokenfirefighter start');
  console.log('  2. In another terminal, run: tokenfirefighter doctor');
  console.log('  3. Start using your AI tool — requests will flow through TokenFirefighter');
  console.log('');

  rl.close();
}

function wrapLine(text: string, width: number): string[] {
  if (text.length <= width) return [text];
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > width) {
      lines.push(current.trim());
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}
