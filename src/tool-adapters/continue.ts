import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export const continueAdapter = {
  id: 'continue',
  name: 'Continue.dev',
  defaultConfigPath() {
    return path.join(os.homedir(), '.continue', 'config.json');
  },
  updateConfig(filePath: string, proxyUrl: string, dryRun: boolean) {
    const resolvedPath = filePath.replace(/^~/, os.homedir());
    const dir = path.dirname(resolvedPath);
    const targetUrl = proxyUrl.endsWith('/v1') ? proxyUrl : `${proxyUrl}/v1`;

    if (!fs.existsSync(resolvedPath)) {
      if (dryRun) {
        return { success: true, summary: `Would create directory "${dir}" and write basic Continue.dev config` };
      }
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        const initialConfig = {
          models: [
            {
              title: "OpenAI GPT-4o (Proxy)",
              provider: "openai",
              model: "gpt-4o",
              apiBase: targetUrl
            }
          ]
        };
        fs.writeFileSync(resolvedPath, JSON.stringify(initialConfig, null, 2), 'utf8');
        return { success: true, summary: `Config file did not exist. Created a new one at "${resolvedPath}" with proxy model.` };
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

    let updatedCount = 0;
    if (Array.isArray(config.models)) {
      for (const model of config.models) {
        if (['openai', 'anthropic', 'gemini'].includes(model.provider)) {
          model.apiBase = targetUrl;
          updatedCount++;
        }
      }
    }

    // Also support updating tabAutocompleteModel
    if (config.tabAutocompleteModel && ['openai', 'anthropic', 'gemini'].includes(config.tabAutocompleteModel.provider)) {
      config.tabAutocompleteModel.apiBase = targetUrl;
      updatedCount++;
    }

    if (dryRun) {
      return { success: true, summary: `Would update ${updatedCount} model providers' apiBase to "${targetUrl}" in "${resolvedPath}"` };
    }

    try {
      const dateSuffix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const backupPath = `${resolvedPath}.backup.${dateSuffix}`;
      fs.copyFileSync(resolvedPath, backupPath);
      fs.writeFileSync(resolvedPath, JSON.stringify(config, null, 2), 'utf8');
      return {
        success: true,
        backupPath,
        summary: `Successfully updated ${updatedCount} model providers' apiBase in "${resolvedPath}". Backed up to "${backupPath}".`
      };
    } catch (err: any) {
      return { success: false, error: err.message, summary: `Failed to update config at "${resolvedPath}"` };
    }
  }
};
