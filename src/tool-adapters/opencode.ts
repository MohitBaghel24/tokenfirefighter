import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as yaml from 'js-yaml';

export const opencodeAdapter = {
  id: 'opencode',
  name: 'OpenCode',
  defaultConfigPath() {
    return path.join(os.homedir(), '.config', 'opencode', 'config.yaml');
  },
  updateConfig(filePath: string, proxyUrl: string, dryRun: boolean) {
    const resolvedPath = filePath.replace(/^~/, os.homedir());
    const dir = path.dirname(resolvedPath);

    if (!fs.existsSync(resolvedPath)) {
      if (dryRun) {
        return { success: true, summary: `Would create directory "${dir}" and write new config with api.baseUrl: "${proxyUrl}"` };
      }
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(resolvedPath, yaml.dump({ api: { baseUrl: proxyUrl } }), 'utf8');
        return { success: true, summary: `Config file did not exist. Created a new one at "${resolvedPath}" with api.baseUrl set to "${proxyUrl}".` };
      } catch (err: any) {
        return { success: false, error: err.message, summary: `Failed to create config file at "${resolvedPath}"` };
      }
    }

    let config: any = {};
    try {
      const content = fs.readFileSync(resolvedPath, 'utf8');
      config = yaml.load(content) || {};
    } catch (err: any) {
      return { success: false, error: err.message, summary: `Failed to parse YAML from "${resolvedPath}"` };
    }

    if (!config.api) {
      config.api = {};
    }
    const oldVal = config.api.baseUrl;
    config.api.baseUrl = proxyUrl;

    if (dryRun) {
      return { success: true, summary: `Would update api.baseUrl from "${oldVal ?? 'undefined'}" to "${proxyUrl}" in "${resolvedPath}"` };
    }

    try {
      const dateSuffix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const backupPath = `${resolvedPath}.backup.${dateSuffix}`;
      fs.copyFileSync(resolvedPath, backupPath);
      fs.writeFileSync(resolvedPath, yaml.dump(config), 'utf8');
      return {
        success: true,
        backupPath,
        summary: `Successfully updated api.baseUrl from "${oldVal ?? 'undefined'}" to "${proxyUrl}" in "${resolvedPath}". Backed up to "${backupPath}".`
      };
    } catch (err: any) {
      return { success: false, error: err.message, summary: `Failed to update config at "${resolvedPath}"` };
    }
  }
};
