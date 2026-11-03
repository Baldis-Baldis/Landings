// Runs tools/check-secrets.mjs in a throwaway git repository: blocked files must stop a commit.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'tools', 'check-secrets.mjs');

function staged(name) {
  const dir = mkdtempSync(join(tmpdir(), 'check-secrets-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir });
    writeFileSync(join(dir, name), 'notes\n');
    execFileSync('git', ['add', '-f', name], { cwd: dir });
    return spawnSync(process.execPath, [script], { cwd: dir, encoding: 'utf8' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

for (const name of ['CLAUDE.md', 'notes.local.md', 'claude.md']) {
  test(`a forced add of ${name} is refused`, () => {
    const run = staged(name);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /private notes/);
  });
}

test('ordinary files pass', () => {
  assert.equal(staged('README.md').status, 0);
});
