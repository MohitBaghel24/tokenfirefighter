import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as yaml from 'js-yaml';

/**
 * Returns the path to the secrets.yaml file depending on the platform.
 */
export function getSecretsPath(): string {
  if (os.platform() === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(localAppData, 'TokenFirefighter', 'secrets.yaml');
  }
  return path.join(os.homedir(), '.tokenfirefighter', 'secrets.yaml');
}

/**
 * Loads and parses secrets from the platform-specific secrets.yaml.
 */
export function loadSecrets(): Record<string, string> {
  const filePath = getSecretsPath();
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = yaml.load(content);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, string>;
    }
  } catch (error) {
    console.error('Error loading secrets:', error);
  }
  return {};
}

/**
 * Saves secrets to the platform-specific secrets.yaml with strict permissions.
 */
export function saveSecrets(secrets: Record<string, string>): void {
  const filePath = getSecretsPath();
  const dirPath = path.dirname(filePath);

  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const yamlStr = yaml.dump(secrets);
    
    // Write secrets with owner read/write permissions only (0o600).
    // Note: Future versions may encrypt keys using Node's crypto module.
    fs.writeFileSync(filePath, yamlStr, { encoding: 'utf8', mode: 0o600 });
    
    // Ensure permissions are set correctly on non-Windows platforms
    if (os.platform() !== 'win32') {
      fs.chmodSync(filePath, 0o600);
    }
  } catch (error) {
    console.error('Error saving secrets:', error);
    throw error;
  }
}

/**
 * Stores a single API key for a provider.
 */
export function storeKey(provider: string, key: string): void {
  const secrets = loadSecrets();
  secrets[provider.toLowerCase()] = key;
  saveSecrets(secrets);
}

/**
 * Removes the API key for a provider.
 */
export function removeKey(provider: string): void {
  const secrets = loadSecrets();
  const providerKey = provider.toLowerCase();
  if (providerKey in secrets) {
    delete secrets[providerKey];
    saveSecrets(secrets);
  }
}

/**
 * Returns a masked representation of the API key for safety.
 */
export function maskKey(key: string): string {
  if (!key) return '(not configured)';
  const trimmed = key.trim();
  if (trimmed.startsWith('sk-ant-')) {
    return `sk-ant-...${trimmed.slice(-4)}`;
  }
  if (trimmed.startsWith('sk-proj-')) {
    return `sk-proj-...${trimmed.slice(-4)}`;
  }
  if (trimmed.startsWith('sk-')) {
    return `sk-...${trimmed.slice(-4)}`;
  }
  if (trimmed.startsWith('gsk_')) {
    return `gsk_...${trimmed.slice(-4)}`;
  }
  if (trimmed.startsWith('AIzaSy')) {
    return `AIzaSy...${trimmed.slice(-4)}`;
  }
  if (trimmed.length >= 8) {
    return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
  }
  return '...';
}
