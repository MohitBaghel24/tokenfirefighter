import { test, describe } from 'node:test';
import assert from 'node:assert';
import { isVersionSufficient } from '../tool-adapters/checkers/base.js';
import { runToolCheck } from '../tool-adapters/checkers/index.js';

describe('compatibility checkers validation engine', () => {
  test('version_sufficient validation logic works', () => {
    // Exact match
    assert.strictEqual(isVersionSufficient('2.0.0', '2.0.0'), true);
    assert.strictEqual(isVersionSufficient('2.0', '2.0'), true);

    // Current version is newer
    assert.strictEqual(isVersionSufficient('2.1.0', '2.0.0'), true);
    assert.strictEqual(isVersionSufficient('3.0', '2.0'), true);
    assert.strictEqual(isVersionSufficient('2.0.1', '2.0.0'), true);

    // Current version is older
    assert.strictEqual(isVersionSufficient('1.9.9', '2.0.0'), false);
    assert.strictEqual(isVersionSufficient('1.5', '2.0'), false);
    assert.strictEqual(isVersionSufficient('2.0.0', '2.0.1'), false);
  });

  test('checkers return valid ToolCheckReport structure', async () => {
    // Test kimchi checker report structure
    const kimchiReport = await runToolCheck('kimchi');
    assert.strictEqual(kimchiReport.tool, 'Kimchi');
    assert.ok(Array.isArray(kimchiReport.checks));
    assert.strictEqual(typeof kimchiReport.compatible, 'boolean');

    // Test a check fields
    if (kimchiReport.checks.length > 0) {
      const firstCheck = kimchiReport.checks[0];
      assert.strictEqual(typeof firstCheck.pass, 'boolean');
      assert.ok(['error', 'warning', 'info'].includes(firstCheck.severity));
      assert.strictEqual(typeof firstCheck.message, 'string');
    }
  });

  test('unsupported tools block correctly', async () => {
    const codyReport = await runToolCheck('cody');
    assert.strictEqual(codyReport.tool, 'Cody (Sourcegraph)');
    assert.strictEqual(codyReport.compatible, false);
    assert.strictEqual(codyReport.checks.length, 1);
    assert.strictEqual(codyReport.checks[0].pass, false);
    assert.strictEqual(codyReport.checks[0].severity, 'error');
  });

  test('unknown custom tools pass validation with advice', async () => {
    const customReport = await runToolCheck('unknown-custom-tool');
    assert.strictEqual(customReport.tool, 'unknown-custom-tool');
    assert.strictEqual(customReport.compatible, true);
    assert.strictEqual(customReport.checks.length, 1);
    assert.strictEqual(customReport.checks[0].pass, true);
  });
});
