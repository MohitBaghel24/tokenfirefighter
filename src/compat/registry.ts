export type SupportLevel = 'full' | 'partial' | 'none';

export interface ToolEntry {
  name: string;
  slug: string;           // e.g., 'claude-code'
  support: SupportLevel;
  notes?: string;         // e.g., 'requires manual API key setup'
  configPath?: string;    // default config file path
  setupCommand?: string;  // how to configure if manual
}

export const TOOL_REGISTRY: ToolEntry[] = [
  {
    name: 'Kimchi',
    slug: 'kimchi',
    support: 'full',
    notes: 'Auto-configured',
    configPath: '~/.kimchi/config.yaml'
  },
  {
    name: 'Claude Code',
    slug: 'claude-code',
    support: 'full',
    notes: 'Auto-configured',
    configPath: '~/.claude/settings.json'
  },
  {
    name: 'OpenCode',
    slug: 'opencode',
    support: 'full',
    notes: 'Auto-configured',
    configPath: '~/.config/opencode/config.yaml'
  },
  {
    name: 'OpenAI SDK',
    slug: 'openai-sdk',
    support: 'full',
    notes: 'Auto-configured via .env',
    configPath: './.env'
  },
  {
    name: 'Ollama',
    slug: 'ollama',
    support: 'full',
    notes: 'Auto-configured'
  },
  {
    name: 'Continue.dev',
    slug: 'continue',
    support: 'full',
    notes: 'Auto-configured',
    configPath: '~/.continue/config.json'
  },
  {
    name: 'Aider',
    slug: 'aider',
    support: 'full',
    notes: 'Auto-configured'
  },
  {
    name: 'LiteLLM',
    slug: 'litellm',
    support: 'full',
    notes: 'Auto-configured'
  },
  {
    name: 'Jupyter AI',
    slug: 'jupyter-ai',
    support: 'partial',
    notes: 'Requires manual OPENAI_API_BASE env var',
    setupCommand: 'export OPENAI_API_BASE=http://localhost:3456/v1'
  },
  {
    name: 'Continue.dev (self-host)',
    slug: 'continue-self-host',
    support: 'partial',
    notes: 'Requires manual configuration (see docs)'
  },
  {
    name: 'LocalAI',
    slug: 'localai',
    support: 'partial',
    notes: 'Requires manual base URL change'
  },
  {
    name: 'Cursor',
    slug: 'cursor',
    support: 'partial',
    notes: 'Settings → OpenAI API base URL (no CLI yet)'
  },
  {
    name: 'Cody (Sourcegraph)',
    slug: 'cody',
    support: 'none',
    notes: 'Uses proprietary API, cannot proxy'
  },
  {
    name: 'AWS CodeWhisperer',
    slug: 'aws-codewhisperer',
    support: 'none',
    notes: 'IAM-based auth, cannot intercept'
  },
  {
    name: 'Tabnine',
    slug: 'tabnine',
    support: 'none',
    notes: 'Proprietary endpoint, cannot proxy'
  },
  {
    name: 'Copilot',
    slug: 'copilot',
    support: 'none',
    notes: 'GitHub-managed endpoints, not interceptable'
  }
];

export function getToolBySlug(slug: string): ToolEntry | undefined {
  return TOOL_REGISTRY.find(t => t.slug === slug);
}

export function getToolByName(name: string): ToolEntry | undefined {
  return TOOL_REGISTRY.find(t => t.name.toLowerCase() === name.toLowerCase());
}
