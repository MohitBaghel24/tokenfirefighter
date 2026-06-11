/**
 * TokenFirefighter — Tool Compatibility & Setup Guide
 *
 * Defines which AI tools are supported, how they route API calls,
 * and step-by-step instructions to wire them through the proxy.
 */

export interface ToolGuide {
  id: string;
  name: string;
  supported: 'full' | 'partial' | 'no';
  description: string;
  provider: 'openai' | 'anthropic' | 'gemini' | 'generic' | 'multiple';
  setupSteps: string[];
  envVars: Record<string, string>;
  detectionHints: string[];
  notes?: string;
}

export const TOOLS: ToolGuide[] = [
  {
    id: 'openai-sdk',
    name: 'OpenAI SDK (Python / Node.js)',
    supported: 'full',
    description: 'Official OpenAI client libraries for Python and Node.js.',
    provider: 'openai',
    setupSteps: [
      'Set environment variable: OPENAI_BASE_URL=http://localhost:7272/v1',
      'Keep OPENAI_API_KEY set to your real key',
      'Run your script normally — requests flow through TokenFirefighter',
    ],
    envVars: { OPENAI_BASE_URL: 'http://localhost:7272/v1', OPENAI_API_KEY: '${YOUR_KEY}' },
    detectionHints: ['process.env.OPENAI_BASE_URL', 'openai.base_url', 'Client(base_url='],
  },
  {
    id: 'claude-code',
    name: 'Claude Code (Anthropic CLI)',
    supported: 'full',
    description: 'Anthropic\'s official CLI coding assistant.',
    provider: 'anthropic',
    setupSteps: [
      'Set ANTHROPIC_BASE_URL=http://localhost:7272/v1',
      'Keep ANTHROPIC_API_KEY set to your real key',
      'Run: claude',
    ],
    envVars: { ANTHROPIC_BASE_URL: 'http://localhost:7272/v1', ANTHROPIC_API_KEY: '${YOUR_KEY}' },
    detectionHints: ['ANTHROPIC_BASE_URL', '.claude', '.anthropic'],
  },
  {
    id: 'kimchi-cli',
    name: 'Kimchi CLI',
    supported: 'no',
    description: 'Kimchi CLI manages its own API connections internally and does not expose a configurable base URL or HTTP proxy option.',
    provider: 'multiple',
    setupSteps: [
      'Unfortunately Kimchi CLI does not support external HTTP proxies.',
      'It communicates directly with its backend servers.',
    ],
    envVars: {},
    detectionHints: ['kimchi', '.kimchi'],
    notes: 'Kimchi CLI is currently NOT compatible with TokenFirefighter because it does not allow overriding the API base URL. You can still use TokenFirefighter with other tools side-by-side.',
  },
  {
    id: 'aider',
    name: 'Aider (AI pair programming)',
    supported: 'full',
    description: 'Popular CLI tool for AI-assisted coding with support for multiple providers.',
    provider: 'multiple',
    setupSteps: [
      'Set OPENAI_API_BASE=http://localhost:7272/v1 (or the provider-specific base URL)',
      'Run: aider --model gpt-4o',
    ],
    envVars: { OPENAI_API_BASE: 'http://localhost:7272/v1', OPENAI_API_KEY: '${YOUR_KEY}' },
    detectionHints: ['aider', '.aider.conf.yml'],
  },
  {
    id: 'continue',
    name: 'Continue.dev (VS Code extension)',
    supported: 'full',
    description: 'Open-source autopilot for VS Code that works with any provider.',
    provider: 'multiple',
    setupSteps: [
      'Open Continue config (~/.continue/config.json or VS Code settings)',
      'Set "apiBase" to "http://localhost:7272/v1" for your provider',
      'Save and reload VS Code',
    ],
    envVars: {},
    detectionHints: ['.continue', 'continue.dev'],
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    supported: 'partial',
    description: 'Some versions support base_url override; check your version.',
    provider: 'openai',
    setupSteps: [
      'Try setting OPENAI_BASE_URL=http://localhost:7272/v1',
      'If unsupported, check OpenCode docs for proxy settings.',
    ],
    envVars: { OPENAI_BASE_URL: 'http://localhost:7272/v1' },
    detectionHints: ['opencode'],
    notes: 'Compatibility varies by OpenCode version.',
  },
  {
    id: 'cursor',
    name: 'Cursor IDE',
    supported: 'no',
    description: 'Cursor uses its own proxy layer and does not expose base URL configuration for the user.',
    provider: 'multiple',
    setupSteps: [
      'Cursor does not support custom API base URLs through user settings.',
      'TokenFirefighter cannot intercept Cursor traffic.',
    ],
    envVars: {},
    detectionHints: ['.cursor', 'Cursor'],
    notes: 'Cursor manages API connections internally. Not compatible.',
  },
  {
    id: 'generic-openai',
    name: 'Any OpenAI-compatible tool',
    supported: 'full',
    description: 'Any tool or script that lets you set a base URL.',
    provider: 'openai',
    setupSteps: [
      'Find the setting for API base URL in your tool.',
      'Set it to http://localhost:7272/v1',
      'Make sure your Authorization header contains your real API key.',
    ],
    envVars: {},
    detectionHints: [],
    notes: 'If your tool supports custom endpoints, it will work with TokenFirefighter.',
  },
];

export function getSupportedTools(): ToolGuide[] {
  return TOOLS.filter(t => t.supported === 'full');
}

export function getUnsupportedTools(): ToolGuide[] {
  return TOOLS.filter(t => t.supported === 'no');
}

export function getToolById(id: string): ToolGuide | undefined {
  return TOOLS.find(t => t.id === id);
}

export function printCompatibilityTable(): void {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    TokenFirefighter — Tool Compatibility                     ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');

  const full = getSupportedTools();
  const partial = TOOLS.filter(t => t.supported === 'partial');
  const no = getUnsupportedTools();

  if (full.length) {
    console.log('║  ✅ FULLY SUPPORTED                                                          ║');
    for (const t of full) {
      const line = `     • ${t.name}`;
      console.log('║' + line.padEnd(78) + '║');
    }
    console.log('║                                                                              ║');
  }

  if (partial.length) {
    console.log('║  ⚠️  PARTIALLY SUPPORTED                                                     ║');
    for (const t of partial) {
      const line = `     • ${t.name} — ${t.notes || ''}`;
      console.log('║' + line.substring(0, 78).padEnd(78) + '║');
    }
    console.log('║                                                                              ║');
  }

  if (no.length) {
    console.log('║  ❌ NOT SUPPORTED                                                            ║');
    for (const t of no) {
      const line = `     • ${t.name} — ${t.notes || ''}`;
      console.log('║' + line.substring(0, 78).padEnd(78) + '║');
    }
    console.log('║                                                                              ║');
  }

  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Run "tokenfirefighter setup" to configure your tool automatically.');
  console.log('Run "tokenfirefighter doctor" to test your current setup.');
  console.log('');
}
