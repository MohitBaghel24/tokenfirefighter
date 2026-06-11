import * as readline from 'node:readline';
import { Writable } from 'node:stream';
import { loadSecrets, storeKey, removeKey, maskKey } from '../config/secrets.js';

// Colored terminal helpers
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

/**
 * Prompts the user with a regular question.
 */
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Prompts the user with a hidden input question.
 */
export function askHiddenQuestion(query: string): Promise<string> {
  return new Promise(resolve => {
    const mutableStdout = new Writable({
      write(chunk, encoding, callback) {
        if (!(this as any).muted) {
          process.stdout.write(chunk, encoding);
        }
        callback();
      }
    }) as any;
    mutableStdout.muted = false;

    const rl = readline.createInterface({
      input: process.stdin,
      output: mutableStdout,
      terminal: true
    });

    process.stdout.write(query);
    mutableStdout.muted = true;

    rl.question('', answer => {
      (mutableStdout as any).muted = false;
      process.stdout.write('\n');
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Command handler for CLI config keys command.
 */
export async function runCliKeys(args: string[]): Promise<void> {
  // Check for remove flags
  let performedAction = false;
  
  const providersToRemove = [
    { flag: '--remove-openai', key: 'openai', label: 'OpenAI' },
    { flag: '--remove-anthropic', key: 'anthropic', label: 'Anthropic' },
    { flag: '--remove-google', key: 'google', label: 'Google (Gemini)' },
    { flag: '--remove-gemini', key: 'google', label: 'Google (Gemini)' },
    { flag: '--remove-mistral', key: 'mistral', label: 'Mistral' },
    { flag: '--remove-groq', key: 'groq', label: 'Groq' }
  ];

  for (const item of providersToRemove) {
    if (args.includes(item.flag)) {
      removeKey(item.key);
      console.log(`${GREEN}Removed ${item.label} API key.${RESET}`);
      performedAction = true;
    }
  }

  // Check for show flags
  if (args.includes('--show')) {
    const secrets = loadSecrets();
    const showFull = args.includes('--full') || args.includes('--show-full');
    
    console.log(`\n${BOLD}TokenFirefighter Stored Keys${RESET}`);
    console.log('────────────────────────────────────');
    
    const displayList = [
      { key: 'openai', label: 'OpenAI' },
      { key: 'anthropic', label: 'Anthropic' },
      { key: 'google', label: 'Google (Gemini)' },
      { key: 'mistral', label: 'Mistral' },
      { key: 'groq', label: 'Groq' }
    ];

    for (const item of displayList) {
      const rawVal = secrets[item.key] || '';
      const displayVal = rawVal 
        ? (showFull ? rawVal : maskKey(rawVal)) 
        : '(not configured)';
      console.log(`${(item.label + ':').padEnd(15)} ${displayVal}`);
    }
    console.log();
    return;
  }

  if (performedAction) {
    return;
  }

  // Otherwise, run the interactive key manager loop
  console.log(`\n  ${BOLD}TokenFirefighter Key Manager${RESET}`);
  console.log('  ────────────────────────────────────');

  while (true) {
    console.log(`\n  ${BOLD}Which provider do you want to configure?${RESET}`);
    console.log('    1. OpenAI');
    console.log('    2. Anthropic');
    console.log('    3. Google (Gemini)');
    console.log('    4. Mistral');
    console.log('    5. Groq');
    console.log('    6. Local / Ollama (no key needed)');
    console.log('    7. Done');

    const choice = await askQuestion('\n  > ');
    
    if (choice === '7' || choice.toLowerCase() === 'done' || choice === '') {
      console.log(`\n  Done. Run \`tokenfirefighter doctor\` to verify everything is working.\n`);
      break;
    }

    if (choice === '1') {
      const key = await askHiddenQuestion('  Enter your OpenAI API key: ');
      if (key) {
        storeKey('openai', key);
        console.log(`  ${GREEN}Key stored securely. TokenFirefighter will inject it automatically.${RESET}`);
      } else {
        console.log(`  ${YELLOW}Skipped. Key was not modified.${RESET}`);
      }
    } else if (choice === '2') {
      const key = await askHiddenQuestion('  Enter your Anthropic API key: ');
      if (key) {
        storeKey('anthropic', key);
        console.log(`  ${GREEN}Key stored securely. TokenFirefighter will inject it automatically.${RESET}`);
      } else {
        console.log(`  ${YELLOW}Skipped. Key was not modified.${RESET}`);
      }
    } else if (choice === '3') {
      const key = await askHiddenQuestion('  Enter your Google (Gemini) API key: ');
      if (key) {
        storeKey('google', key);
        console.log(`  ${GREEN}Key stored securely. TokenFirefighter will inject it automatically.${RESET}`);
      } else {
        console.log(`  ${YELLOW}Skipped. Key was not modified.${RESET}`);
      }
    } else if (choice === '4') {
      const key = await askHiddenQuestion('  Enter your Mistral API key: ');
      if (key) {
        storeKey('mistral', key);
        console.log(`  ${GREEN}Key stored securely. TokenFirefighter will inject it automatically.${RESET}`);
      } else {
        console.log(`  ${YELLOW}Skipped. Key was not modified.${RESET}`);
      }
    } else if (choice === '5') {
      const key = await askHiddenQuestion('  Enter your Groq API key: ');
      if (key) {
        storeKey('groq', key);
        console.log(`  ${GREEN}Key stored securely. TokenFirefighter will inject it automatically.${RESET}`);
      } else {
        console.log(`  ${YELLOW}Skipped. Key was not modified.${RESET}`);
      }
    } else if (choice === '6') {
      console.log(`  ${CYAN}Local / Ollama requires no API key.${RESET}`);
    } else {
      console.log(`  ${YELLOW}Invalid selection. Please choose an option from 1 to 7.${RESET}`);
    }
  }
}
