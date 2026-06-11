import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

export interface CheckResult {
  pass: boolean;
  severity: 'error' | 'warning' | 'info';
  message: string;
  fix?: string;
  docsUrl?: string;
}

export interface ToolCheckReport {
  tool: string;
  installed: boolean;
  version?: string;
  compatible: boolean;
  checks: CheckResult[];
}

/**
 * Finds the absolute path to a binary in PATH.
 */
export function findBinaryPath(binaryName: string): string | null {
  try {
    const cmd = os.platform() === 'win32' ? `where ${binaryName}` : `which ${binaryName}`;
    const stdout = execSync(cmd, { stdio: ['pipe', 'pipe', 'ignore'], env: process.env }).toString().trim();
    return stdout.split('\n')[0] || null;
  } catch {
    return null;
  }
}

/**
 * Normalizes user paths containing ~ to home directory.
 */
export function resolveHomePath(filePath: string): string {
  return filePath.replace(/^~/, os.homedir());
}

/**
 * Checks if a version string meets a minimum version requirement.
 */
export function isVersionSufficient(current: string, minimum: string): boolean {
  const parse = (v: string) => v.split('.').map(x => parseInt(x, 10) || 0);
  const curParts = parse(current.replace(/[^0-9.]/g, ''));
  const minParts = parse(minimum.replace(/[^0-9.]/g, ''));

  for (let i = 0; i < Math.max(curParts.length, minParts.length); i++) {
    const curVal = curParts[i] || 0;
    const minVal = minParts[i] || 0;
    if (curVal > minVal) return true;
    if (curVal < minVal) return false;
  }
  return true;
}

/**
 * Generic binary_in_path check.
 */
export function checkBinaryInPath(binaryName: string, installCommand: string, label: string): { pass: boolean; check: CheckResult; path: string | null } {
  const binPath = findBinaryPath(binaryName);
  if (!binPath) {
    return {
      pass: false,
      path: null,
      check: {
        pass: false,
        severity: 'error',
        message: `${label} CLI not found in PATH. Install it first: ${installCommand}`,
        fix: installCommand
      }
    };
  }
  return {
    pass: true,
    path: binPath,
    check: {
      pass: true,
      severity: 'info',
      message: `${label} binary found at ${binPath}`
    }
  };
}

/**
 * Generic version_sufficient check.
 */
export function checkVersionSufficient(
  binaryName: string, 
  getVersionCmd: string, 
  minVersion: string, 
  upgradeCmd: string, 
  label: string
): { pass: boolean; check: CheckResult; version?: string } {
  try {
    const stdout = execSync(`${binaryName} ${getVersionCmd}`, { stdio: ['pipe', 'pipe', 'ignore'], env: process.env }).toString().trim();
    const versionMatch = stdout.match(/(\d+\.\d+(?:\.\d+)?)/);
    if (!versionMatch) {
      return {
        pass: false,
        check: {
          pass: false,
          severity: 'warning',
          message: `Could not parse version for ${label}. Tool may still be compatible.`,
          fix: upgradeCmd
        }
      };
    }

    const version = versionMatch[1];
    const sufficient = isVersionSufficient(version, minVersion);

    if (!sufficient) {
      return {
        pass: false,
        version,
        check: {
          pass: false,
          severity: 'error',
          message: `${label} version ${version} is too old. Upgrade to v${minVersion}+: ${upgradeCmd}`,
          fix: upgradeCmd
        }
      };
    }

    return {
      pass: true,
      version,
      check: {
        pass: true,
        severity: 'info',
        message: `${label} version ${version} is compatible (min v${minVersion})`
      }
    };
  } catch (err: any) {
    return {
      pass: false,
      check: {
        pass: false,
        severity: 'warning',
        message: `Failed to execute ${binaryName} to check version. Details: ${err.message}`,
        fix: upgradeCmd
      }
    };
  }
}

/**
 * Generic config_writable check.
 */
export function checkConfigWritable(configPath: string, label: string): CheckResult {
  const resolved = resolveHomePath(configPath);
  const dir = path.dirname(resolved);

  try {
    if (fs.existsSync(resolved)) {
      fs.accessSync(resolved, fs.constants.W_OK);
    } else {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.accessSync(dir, fs.constants.W_OK);
    }
    return {
      pass: true,
      severity: 'info',
      message: `Config file/directory is writable: ${configPath}`
    };
  } catch {
    const chmodFix = `chmod +w ${resolved}`;
    return {
      pass: false,
      severity: 'error',
      message: `Config directory/file for ${label} is not writable by TokenFirefighter.`,
      fix: chmodFix
    };
  }
}

/**
 * Generic already_proxied check.
 */
export function checkAlreadyProxied(
  configPath: string, 
  currentBaseUrl: string | undefined, 
  label: string
): CheckResult {
  if (!currentBaseUrl) {
    return {
      pass: true,
      severity: 'info',
      message: `${label} has no current proxy or base URL configured.`
    };
  }

  const isTfUrl = currentBaseUrl.includes('localhost:3456') || 
                    currentBaseUrl.includes('127.0.0.1:3456') || 
                    currentBaseUrl.includes('localhost:7272') || 
                    currentBaseUrl.includes('127.0.0.1:7272');
                    
  const isDefaultProviderUrl = currentBaseUrl.includes('api.openai.com') ||
                               currentBaseUrl.includes('api.anthropic.com') ||
                               currentBaseUrl.includes('googleapis.com') ||
                               currentBaseUrl.includes('api.mistral.ai') ||
                               currentBaseUrl.includes('api.groq.com');

  if (!isTfUrl && !isDefaultProviderUrl) {
    return {
      pass: false,
      severity: 'warning',
      message: `${label} is already using another proxy at ${currentBaseUrl}. TokenFirefighter may conflict.`,
      fix: `Point your ${label} base URL config to TokenFirefighter`
    };
  }

  return {
    pass: true,
    severity: 'info',
    message: `${label} proxy setting is clean.`
  };
}

/**
 * Generic sandbox_detected check.
 */
export function checkSandbox(binaryPath: string | null, label: string, alternativeInstall: string): CheckResult {
  if (!binaryPath) {
    return {
      pass: true,
      severity: 'info',
      message: `Sandbox check skipped (binary not found).`
    };
  }

  const lowerPath = binaryPath.toLowerCase();

  // macOS App Store check
  if (os.platform() === 'darwin') {
    if (lowerPath.includes('library/containers') || lowerPath.includes('mas')) {
      return {
        pass: false,
        severity: 'error',
        message: `App Store versions of ${label} cannot use TokenFirefighter because they run in a sandbox. Install via: ${alternativeInstall}`,
        fix: alternativeInstall
      };
    }
  }

  // Snap check (Linux)
  if (lowerPath.includes('/snap/')) {
    return {
      pass: false,
      severity: 'error',
      message: `Snap installs cannot reach localhost proxies. Remove and install via: ${alternativeInstall}`,
      fix: alternativeInstall
    };
  }

  // Flatpak check (Linux)
  if (lowerPath.includes('flatpak') || fs.existsSync('/.flatpak-info')) {
    return {
      pass: false,
      severity: 'error',
      message: `Flatpak sandbox blocks localhost. Run with --network=host or install natively.`,
      fix: alternativeInstall
    };
  }

  return {
    pass: true,
    severity: 'info',
    message: `${label} is not running in a detected sandbox.`
  };
}

/**
 * Generic env_conflict check.
 */
export function checkEnvConflict(): CheckResult[] {
  const checks: CheckResult[] = [];
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const noProxy = process.env.NO_PROXY || process.env.no_proxy;

  if (httpsProxy) {
    checks.push({
      pass: false,
      severity: 'warning',
      message: `Environment variable HTTPS_PROXY is set to "${httpsProxy}". This may block localhost proxy routing.`,
      fix: 'unset HTTPS_PROXY'
    });
  }

  if (noProxy) {
    const parts = noProxy.split(',').map(p => p.trim().toLowerCase());
    if (parts.includes('localhost') || parts.includes('127.0.0.1') || parts.includes('*')) {
      checks.push({
        pass: false,
        severity: 'warning',
        message: `Environment variable NO_PROXY blocks localhost/127.0.0.1: "${noProxy}".`,
        fix: 'unset NO_PROXY'
      });
    }
  }

  if (checks.length === 0) {
    checks.push({
      pass: true,
      severity: 'info',
      message: 'No proxy environment conflicts detected.'
    });
  }

  return checks;
}
