#!/usr/bin/env node
// Refuses commits containing secrets or files that must stay out of this public repo.
// Default: checks staged files (run by .githooks/pre-commit). --all: checks every tracked file.
// Standard library only. Findings never print the matched value.
import { execFileSync } from 'node:child_process';

const SECRET_PATTERNS = [
  ['GitHub token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}/],
  ['GitHub fine-grained token', /\bgithub_pat_[A-Za-z0-9_]{20,}/],
  ['Supabase secret key', /\bsb_secret_[A-Za-z0-9_-]{10,}/],
  ['JWT (legacy Supabase key?)', /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\./],
  ['Private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['age secret key', /AGE-SECRET-KEY-1[A-Z0-9]{20,}/],
  ['Resend API key', /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9_]{16,}/],
  ['AWS-style access key', /\bAKIA[A-Z0-9]{16}\b/],
  ['Database URL with password', /\bpostgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@/],
];

const BLOCKED_FILES = [
  [/(^|\/)\.env(\.(?!example$)[^/]*)?$/, 'environment file'],
  [/\.(pem|key|p8|p12|pfx)$/i, 'key file'],
  [/\.(dump|backup|sql\.gz|age)$/i, 'backup or dump'],
  [/(^|\/)backups\//, 'backup folder'],
  // Notes on infrastructure and risks live in the private backup repository, never here.
  [/(^|\/)CLAUDE\.md$|\.local\.md$/i, 'private notes'],
];

const git = (...args) => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 });
const list = out => out.toString('utf8').split('\0').filter(Boolean);

function targets(all) {
  if (all) return list(git('ls-files', '-z')).map(path => [path, () => git('show', 'HEAD:' + path)]);
  return list(git('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'))
    .map(path => [path, () => git('show', ':' + path)]);
}

function check(path, read) {
  const found = [];
  for (const [re, label] of BLOCKED_FILES) if (re.test(path)) found.push(`${path}: blocked file (${label})`);
  const content = read();
  if (content.includes(0)) return found; // binary
  content.toString('utf8').split(/\r?\n/).forEach((line, i) => {
    for (const [label, re] of SECRET_PATTERNS) if (re.test(line)) found.push(`${path}:${i + 1}: ${label}`);
  });
  return found;
}

const findings = targets(process.argv.includes('--all')).flatMap(([path, read]) => check(path, read));
if (findings.length) {
  console.error('check-secrets: commit refused:\n  ' + findings.join('\n  '));
  console.error('Remove the secret. If it was ever pushed, revoke it: deleting it is not enough.');
  process.exit(1);
}
console.log('check-secrets: OK');
