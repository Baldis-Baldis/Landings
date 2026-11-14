// Runs tools/check-secrets.mjs in a throwaway git repository: blocked files must stop a commit.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'tools', 'check-secrets.mjs');

function staged(name) {
  const dir = mkdtempSync(join(tmpdir(), 'check-secrets-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir });
    mkdirSync(dirname(join(dir, name)), { recursive: true });
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

// local secrets such as an API key for a data tool; a .local.md file stays private notes
for (const name of ['openaip-key.local', 'api.local', 'openaip-key.txt', 'tools/openaip-key.json', 'OpenAIP-Key.TXT']) {
  test(`a forced add of ${name} is refused`, () => {
    const run = staged(name);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /local secret file/);
  });
}

test('the refusal never prints what the file holds', () => {
  const run = staged('openaip-key.local');
  assert.ok(!/notes/.test(run.stdout + run.stderr.replace(/private notes/g, '')));
});

test('ordinary files pass, also names that only contain "local"', () => {
  assert.equal(staged('README.md').status, 0);
  assert.equal(staged('settings.local.json').status, 0);
  assert.equal(staged('localization.js').status, 0);
});

test('.gitignore keeps local secrets out of the repository too', () => {
  const ignore = readFileSync(join(dirname(script), '..', '.gitignore'), 'utf8').split(/\r?\n/);
  for (const rule of ['*.local', 'openaip-key*', '*.local.md']) assert.ok(ignore.includes(rule), rule);
});
