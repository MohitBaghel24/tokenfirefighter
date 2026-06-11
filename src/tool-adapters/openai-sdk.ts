import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export const openaiSdkAdapter = {
  id: 'openai-sdk',
  name: 'OpenAI SDK',
  defaultConfigPath() {
    return path.join(process.cwd(), '.env');
  },
  updateConfig(filePath: string, proxyUrl: string, dryRun: boolean) {
    const resolvedPath = path.resolve(filePath.replace(/^~/, os.homedir()));
    const targetUrl = proxyUrl.endsWith('/v1') ? proxyUrl : `${proxyUrl}/v1`;

    if (!fs.existsSync(resolvedPath)) {
      if (dryRun) {
        return { success: true, summary: `Would create new env file at "${resolvedPath}" with OPENAI_BASE_URL=${targetUrl} and OPENAI_API_KEY=dummy-tokenfirefighter-key` };
      }
      try {
        fs.writeFileSync(resolvedPath, `OPENAI_BASE_URL=${targetUrl}\nOPENAI_API_KEY=dummy-tokenfirefighter-key\n`, 'utf8');
        return { success: true, summary: `Config file did not exist. Created a new one at "${resolvedPath}" with OPENAI_BASE_URL set to "${targetUrl}" and a dummy API key.` };
      } catch (err: any) {
        return { success: false, error: err.message, summary: `Failed to create env file at "${resolvedPath}"` };
      }
    }

    let content = '';
    try {
      content = fs.readFileSync(resolvedPath, 'utf8');
    } catch (err: any) {
      return { success: false, error: err.message, summary: `Failed to read env file from "${resolvedPath}"` };
    }

    const lines = content.split(/\r?\n/);
    let found = false;
    let hasApiKey = false;
    let oldVal = '';

    const updatedLines = lines.map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('OPENAI_BASE_URL=') || trimmed.startsWith('OPENAI_BASE_URL =')) {
        found = true;
        const parts = line.split('=');
        oldVal = parts.slice(1).join('=').trim();
        return `OPENAI_BASE_URL=${targetUrl}`;
      }
      if (trimmed.startsWith('OPENAI_API_KEY=') || trimmed.startsWith('OPENAI_API_KEY =')) {
        hasApiKey = true;
      }
      return line;
    });

    if (!found) {
      updatedLines.push(`OPENAI_BASE_URL=${targetUrl}`);
    }
    if (!hasApiKey) {
      updatedLines.push(`OPENAI_API_KEY=dummy-tokenfirefighter-key`);
    }

    const newContent = updatedLines.join('\n');

    if (dryRun) {
      let dryRunSummary = '';
      if (found) {
        dryRunSummary = `Would update OPENAI_BASE_URL from "${oldVal}" to "${targetUrl}" in "${resolvedPath}"`;
      } else {
        dryRunSummary = `Would append OPENAI_BASE_URL=${targetUrl} to "${resolvedPath}"`;
      }
      if (!hasApiKey) {
        dryRunSummary += ` and append OPENAI_API_KEY=dummy-tokenfirefighter-key`;
      }
      return { success: true, summary: dryRunSummary };
    }

    try {
      const dateSuffix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const backupPath = `${resolvedPath}.backup.${dateSuffix}`;
      fs.copyFileSync(resolvedPath, backupPath);
      fs.writeFileSync(resolvedPath, newContent, 'utf8');
      return {
        success: true,
        backupPath,
        summary: found
          ? `Successfully updated OPENAI_BASE_URL from "${oldVal}" to "${targetUrl}" in "${resolvedPath}". Backed up to "${backupPath}".`
          : `Successfully appended OPENAI_BASE_URL=${targetUrl} to "${resolvedPath}". Backed up to "${backupPath}".`
      };
    } catch (err: any) {
      return { success: false, error: err.message, summary: `Failed to update env file at "${resolvedPath}"` };
    }
  }
};
