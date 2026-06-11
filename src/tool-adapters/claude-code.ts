import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export const claudeCodeAdapter = {
  id: 'claude-code',
  name: 'Claude Code',
  defaultConfigPath() {
    const path1 = path.join(os.homedir(), '.claude', 'settings.json');
    const path2 = path.join(os.homedir(), '.claude-cli', 'config.json');
    if (!fs.existsSync(path1) && fs.existsSync(path2)) {
      return path2;
    }
    return path1;
  },
  updateConfig(filePath: string, proxyUrl: string, dryRun: boolean) {
    const resolvedPath = filePath.replace(/^~/, os.homedir());
    const dir = path.dirname(resolvedPath);

    if (!fs.existsSync(resolvedPath)) {
      if (dryRun) {
        return { success: true, summary: `Would create directory "${dir}" and write new JSON config with primaryApiUrl/apiUrl: "${proxyUrl}"` };
      }
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(resolvedPath, JSON.stringify({ primaryApiUrl: proxyUrl, apiUrl: proxyUrl }, null, 2), 'utf8');
        return { success: true, summary: `Config file did not exist. Created a new one at "${resolvedPath}" with primaryApiUrl and apiUrl set to "${proxyUrl}".` };
      } catch (err: any) {
        return { success: false, error: err.message, summary: `Failed to create config file at "${resolvedPath}"` };
      }
    }

    let config: any = {};
    try {
      const content = fs.readFileSync(resolvedPath, 'utf8');
      config = JSON.parse(content) || {};
    } catch (err: any) {
      return { success: false, error: err.message, summary: `Failed to parse JSON from "${resolvedPath}"` };
    }

    const oldPrimary = config.primaryApiUrl;
    const oldApiUrl = config.apiUrl;

    config.primaryApiUrl = proxyUrl;
    config.apiUrl = proxyUrl;

    if (dryRun) {
      return { success: true, summary: `Would update primaryApiUrl from "${oldPrimary ?? 'undefined'}" to "${proxyUrl}" and apiUrl from "${oldApiUrl ?? 'undefined'}" to "${proxyUrl}" in "${resolvedPath}"` };
    }

    try {
      const dateSuffix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const backupPath = `${resolvedPath}.backup.${dateSuffix}`;
      fs.copyFileSync(resolvedPath, backupPath);
      fs.writeFileSync(resolvedPath, JSON.stringify(config, null, 2), 'utf8');
      return {
        success: true,
        backupPath,
        summary: `Successfully updated primaryApiUrl/apiUrl to "${proxyUrl}" in "${resolvedPath}". Backed up to "${backupPath}".`
      };
    } catch (err: any) {
      return { success: false, error: err.message, summary: `Failed to update config at "${resolvedPath}"` };
    }
  }
};
