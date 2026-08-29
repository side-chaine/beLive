#!/usr/bin/env node
/**
 * check-secrets.mjs — gate that keeps credentials out of the repository.
 *
 * Born from the MVSEP incident (2026-08-29): a real API key lived in
 * `belive-mvsep/DEPLOY.md` inside a commit on a public repo, declared as
 * `VITE_MVSEP_API_KEY`. Vite inlines every VITE_* variable into the client
 * bundle, so that key would have shipped to every visitor.
 *
 * Three rules, deliberately at different scopes:
 *
 *   R1 (code + config only)  VITE_* variable whose name smells like a secret.
 *       Architectural bug even with no literal value: Vite publishes VITE_*.
 *
 *   R2 (every text file)     Known secret shape: Google / OpenAI / GitHub /
 *       Slack / AWS / PEM / DB URI with inline password.
 *
 *   R3 (every text file)     `SECRET_NAME = value` where the value is a real
 *       value rather than a placeholder, env reference or redaction marker.
 *       This is the rule that would have caught MVSEP in DEPLOY.md.
 *
 * Usage:
 *   node scripts/check-secrets.mjs              # scan tracked files
 *   node scripts/check-secrets.mjs --all        # include untracked
 *   node scripts/check-secrets.mjs --staged     # only what is about to commit
 *   node scripts/check-secrets.mjs --install-hook
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, chmodSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const args = new Set(process.argv.slice(2));

// ─── Scopes ───────────────────────────────────────────────────────────────

// R1 only matters where a variable is actually declared or consumed.
const CODE_OR_CONFIG =
  /\.(?:ts|tsx|js|jsx|mjs|cjs|mts|cts|json|toml|ya?ml|env|sh|ps1|py|go|rs)$|^(?:\.env|wrangler\.)/i;

// ─── R1 ───────────────────────────────────────────────────────────────────

const R1 = {
  id: 'R1-VITE-SECRET',
  re: /VITE_[A-Z0-9_]*?(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|PRIVATE)[A-Z0-9_]*/g,
  why:
    'Vite inlines every VITE_* variable into the client bundle. A secret here is ' +
    'published to every visitor. Server-side secrets go through `wrangler secret put` ' +
    'and are read as env.* inside the Worker.',
};

// ─── R2 ───────────────────────────────────────────────────────────────────

const R2_RULES = [
  { id: 'R2-GOOGLE', re: /AIza[0-9A-Za-z_-]{35}/g,                 why: 'Google API key' },
  { id: 'R2-OPENAI', re: /\bsk-[A-Za-z0-9]{20,}\b/g,               why: 'OpenAI-style key' },
  { id: 'R2-GITHUB', re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g,        why: 'GitHub token' },
  { id: 'R2-SLACK',  re: /\bxox[abposr]-[A-Za-z0-9-]{10,}\b/g,     why: 'Slack token' },
  { id: 'R2-AWS',    re: /\bAKIA[0-9A-Z]{16}\b/g,                  why: 'AWS access key id' },
  { id: 'R2-PEM',
    re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g,
    why: 'private key' },
  { id: 'R2-DB-URI',
    re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s'"`]*:[^\s'"`@]*@/g,
    why: 'database URI with inline password' },
];

// ─── R3 ───────────────────────────────────────────────────────────────────

const SECRETISH_NAME = '[A-Za-z][A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|APIKEY)';

// NAME = value   /   "NAME": "value"   /   NAME: 'value'
const QUOTE = '["\'`]';
const R3 = {
  id: 'R3-ASSIGNMENT',
  re: new RegExp(
    '\\b(' + SECRETISH_NAME + ')\\b' +
      QUOTE + '?\\s*[:=]\\s*' + QUOTE + '?' +
      '([^\\s"\'`;,)]{8,})',
    'g',
  ),
  why: 'assignment of a credential-looking value that is not a placeholder or env reference',
};

// A value that is clearly not a real secret.
const NOT_A_SECRET =
  /^(?:\$\{?|\{|<|%|your|xxx+|changeme|placeholder|example|sample|todo|tbd|none|null|empty|redacted|dummy|fake|test|abcdef|123456|0+$|a+$)/i;

const ALL_SAME_CHAR = /^(.)\1*$/;

// Enough entropy to be a real credential rather than prose.
function looksLikeSecret(v) {
  if (NOT_A_SECRET.test(v)) return false;
  if (ALL_SAME_CHAR.test(v)) return false;
  if (v.length < 16) return false;
  if (/^(?:true|false|undefined|string|number|boolean|function|object)$/i.test(v)) return false;
  // Real keys are a mix of letters and digits; prose and identifiers are not.
  return /[A-Za-z]/.test(v) && /\d/.test(v);
}

// ─── File selection ───────────────────────────────────────────────────────

function git(argv) {
  return execFileSync('git', argv, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function listFiles() {
  if (args.has('--staged')) {
    return git(['diff', '--cached', '--name-only', '--diff-filter=ACM']).split('\n').filter(Boolean);
  }
  if (args.has('--all')) {
    const visible = git(['ls-files', '--cached', '--others', '--exclude-standard']);
    // Gitignored files are exactly where secrets hide (.env, *.pem). List them
    // too — but only the shapes that can hold a credential, so we never walk
    // node_modules.
    const ignored = git(['ls-files', '--others', '--ignored', '--exclude-standard'])
      .split('\n')
      .filter((f) => IGNORED_SECRETABLE.test(f));
    return [...visible.split('\n'), ...ignored].filter(Boolean);
  }
  return git(['ls-files']).split('\n').filter(Boolean);
}

// Gitignored files worth scanning even though git hides them.
const IGNORED_SECRETABLE = /(?:^|\/)(?:\.env(?:\..*)?|\.dev\.vars|\.npmrc|\.dockercfg|credentials|.*\.(?:pem|key|p12|pfx|keystore|jks))$/i;

const SKIP_DIR = /^(?:node_modules|\.git|dist|build|coverage|\.wrangler|\.next|vendor)\//;
const SKIP_FILE = /(?:\.min\.js|\.map|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb|\.svg|\.png|\.jpe?g|\.gif|\.ico|\.woff2?|\.ttf|\.mp3|\.wav|\.pdf)$/;

// Files that discuss the rules rather than carry secrets.
const EXPLAINING = new Set([
  'scripts/check-secrets.mjs',
  'docs/audit/06-MVSEP-REMEDIATION.md',
  'docs/audit/07-SECRETS-FULL-SWEEP.md',
]);

// Suppression. A gate that is permanently red gets bypassed with --no-verify,
// so known-and-accepted findings must be suppressible — but every suppression
// stays visible, greppable and carries a reason. Same convention as ESLint:
//
//   const K = import.meta.env.VITE_X_KEY; // secret-ok: reason
//   // secret-ok-next-line: reason
//   const K = import.meta.env.VITE_X_KEY;
const SUPPRESS = /\bsecret-ok\b(?!-next-line)/;
const SUPPRESS_NEXT = /\bsecret-ok-next-line\b/;

// ─── Scan ─────────────────────────────────────────────────────────────────

function scanText(text, { isCodeOrConfig }) {
  const hits = [];

  const lines = text.split('\n');
  let suppressed = -1; // index of a line silenced by `secret-ok-next-line`

  lines.forEach((line, i) => {
    if (suppressed === i) { suppressed = -1; return; }
    if (SUPPRESS.test(line)) return;
    if (SUPPRESS_NEXT.test(line)) { suppressed = i + 1; return; }

    if (isCodeOrConfig) {
      for (const m of line.matchAll(R1.re)) {
        hits.push({ rule: R1.id, line: i + 1, match: m[0], why: R1.why });
      }
    }

    for (const rule of R2_RULES) {
      for (const m of line.matchAll(rule.re)) {
        hits.push({ rule: rule.id, line: i + 1, match: mask(m[0]), why: rule.why });
      }
    }

    for (const m of line.matchAll(R3.re)) {
      if (looksLikeSecret(m[2])) {
        hits.push({
          rule: R3.id,
          line: i + 1,
          match: `${m[1]} = ${mask(m[2])}`,
          why: R3.why,
        });
      }
    }
  });

  return hits;
}

// Never echo a full secret into CI logs — that is how a leak propagates.
function mask(s) {
  if (s.length <= 8) return '****';
  return `${s.slice(0, 4)}…${s.slice(-2)} (${s.length} chars)`;
}

// ─── Entrypoint ───────────────────────────────────────────────────────────

function main() {
  if (args.has('--install-hook')) return installHook();

  const files = listFiles().filter((f) => !SKIP_DIR.test(f) && !SKIP_FILE.test(f));
  const report = [];

  for (const file of files) {
    const rel = relative(ROOT, resolve(ROOT, file)).replace(/\\/g, '/');
    if (EXPLAINING.has(rel)) continue;

    let text;
    try {
      text = readFileSync(resolve(ROOT, file), 'utf8');
    } catch {
      continue; // binary, or removed mid-scan
    }
    if (text.includes('\u0000')) continue;

    const hits = scanText(text, { isCodeOrConfig: CODE_OR_CONFIG.test(rel) });
    if (hits.length) report.push({ file: rel, hits });
  }

  if (report.length) {
    console.error('\n=== SECRET SCAN ===\n');
    for (const { file, hits } of report) {
      console.error(`\n${file}`);
      for (const h of hits.slice(0, 8)) {
        console.error(`   ${h.rule}  L${h.line}: ${h.match}`);
        console.error(`   └─ ${h.why}`);
      }
      if (hits.length > 8) console.error(`   … and ${hits.length - 8} more`);
    }
    console.error(`\nGATE FAILED — ${report.length} file(s) with blocked patterns.\n`);
    return 1;
  }

  console.log(`clean — ${files.length} file(s) scanned.`);
  return 0;
}

function installHook() {
  const hookPath = resolve(ROOT, '.git/hooks/pre-commit');
  writeFileSync(
    hookPath,
    `#!/bin/sh
# Installed by scripts/check-secrets.mjs — blocks credentials at commit time.
node scripts/check-secrets.mjs --staged || {
  echo ""
  echo "Commit blocked by the secret gate."
  echo "If this is a false positive, add the file to EXPLAINING in the script,"
  echo "or narrow the rule. Emergency bypass: git commit --no-verify"
  exit 1
}
`,
    'utf8',
  );
  try {
    chmodSync(hookPath, 0o755);
  } catch {
    /* Windows: mode bits are advisory; git still runs the hook through sh */
  }
  console.log(`pre-commit hook installed -> ${hookPath}`);
  return 0;
}

if (!existsSync(resolve(ROOT, '.git'))) {
  console.error('not a git repository — refusing to report a false "clean".');
  process.exit(2);
}

process.exit(main());
