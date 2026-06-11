import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as yaml from 'js-yaml';

export const customAdapter = {
  id: 'custom',
  name: 'Custom (Other)',
  defaultConfigPath() {
    return '';
  },
  updateConfig(filePath: string, proxyUrl: string, dryRun: boolean, options?: { keyPath?: string }) {
    const resolvedPath = filePath.replace(/^~/, os.homedir());
    const keyPath = options?.keyPath || 'api_base';

    if (!fs.existsSync(resolvedPath)) {
      return { success: false, summary: `Configuration file not found at "${resolvedPath}". Please make sure the path is correct.` };
    }

    const isJson = resolvedPath.endsWith('.json');
    const isYaml = resolvedPath.endsWith('.yaml') || resolvedPath.endsWith('.yml');

    try {
      const fileContent = fs.readFileSync(resolvedPath, 'utf8');

      if (isJson) {
        const data = JSON.parse(fileContent);
        const keys = keyPath.split('.');
        let current = data;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) {
            current[keys[i]] = {};
          }
          current = current[keys[i]];
        }
        const oldVal = current[keys[keys.length - 1]];
        current[keys[keys.length - 1]] = proxyUrl;

        if (dryRun) {
          return { success: true, summary: `Would update JSON key "${keyPath}" from "${oldVal ?? 'undefined'}" to "${proxyUrl}" in "${resolvedPath}"` };
        }

        const dateSuffix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const backupPath = `${resolvedPath}.backup.${dateSuffix}`;
        fs.copyFileSync(resolvedPath, backupPath);
        fs.writeFileSync(resolvedPath, JSON.stringify(data, null, 2), 'utf8');
        return { success: true, backupPath, summary: `Successfully updated JSON key "${keyPath}" to "${proxyUrl}" in "${resolvedPath}". Backed up to "${backupPath}".` };
      } else if (isYaml) {
        const data = yaml.load(fileContent) as any;
        const keys = keyPath.split('.');
        let current = data;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) {
            current[keys[i]] = {};
          }
          current = current[keys[i]];
        }
        const oldVal = current[keys[keys.length - 1]];
        current[keys[keys.length - 1]] = proxyUrl;

        if (dryRun) {
          return { success: true, summary: `Would update YAML key "${keyPath}" from "${oldVal ?? 'undefined'}" to "${proxyUrl}" in "${resolvedPath}"` };
        }

        const dateSuffix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const backupPath = `${resolvedPath}.backup.${dateSuffix}`;
        fs.copyFileSync(resolvedPath, backupPath);
        fs.writeFileSync(resolvedPath, yaml.dump(data), 'utf8');
        return { success: true, backupPath, summary: `Successfully updated YAML key "${keyPath}" to "${proxyUrl}" in "${resolvedPath}". Backed up to "${backupPath}".` };
      } else {
        // Fallback for .env or other plain text config
        const lines = fileContent.split(/\r?\n/);
        let found = false;
        let oldVal = '';

        const updatedLines = lines.map(line => {
          const trimmed = line.trim();
          if (trimmed.startsWith(`${keyPath}=`) || trimmed.startsWith(`${keyPath} =`)) {
            found = true;
            const parts = line.split('=');
            oldVal = parts.slice(1).join('=').trim();
            return `${keyPath}=${proxyUrl}`;
          }
          return line;
        });

        if (!found) {
          updatedLines.push(`${keyPath}=${proxyUrl}`);
        }

        if (dryRun) {
          return {
            success: true,
            summary: found
              ? `Would update "${keyPath}" from "${oldVal}" to "${proxyUrl}" in "${resolvedPath}"`
              : `Would append "${keyPath}=${proxyUrl}" to "${resolvedPath}"`
          };
        }

        const dateSuffix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const backupPath = `${resolvedPath}.backup.${dateSuffix}`;
        fs.copyFileSync(resolvedPath, backupPath);
        fs.writeFileSync(resolvedPath, updatedLines.join('\n'), 'utf8');
        return {
          success: true,
          backupPath,
          summary: found
            ? `Successfully updated "${keyPath}" from "${oldVal}" to "${proxyUrl}" in "${resolvedPath}". Backed up to "${backupPath}".`
            : `Successfully appended "${keyPath}=${proxyUrl}" to "${resolvedPath}". Backed up to "${backupPath}".`
        };
      }
    } catch (err: any) {
      return { success: false, error: err.message, summary: `Failed to update custom configuration: ${err.message}` };
    }
  }
};
