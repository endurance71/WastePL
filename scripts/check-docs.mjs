import { spawnSync } from 'node:child_process';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const docsRoot = path.join(root, 'docs');
const errors = [];

async function collectMarkdown(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectMarkdown(fullPath));
    if (entry.isFile() && entry.name.endsWith('.md')) files.push(fullPath);
  }

  return files;
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function normalizeHeading(value) {
  return value
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()
    .toLocaleLowerCase('pl-PL');
}

async function checkLocalLink(file, target, line) {
  const cleanTarget = target.split('#')[0].split('?')[0];
  if (!cleanTarget || /^(?:https?:|mailto:|tel:)/i.test(cleanTarget)) return;

  let decoded;
  try {
    decoded = decodeURIComponent(cleanTarget);
  } catch {
    errors.push(`${relative(file)}:${line}: malformed link encoding: ${target}`);
    return;
  }

  const resolved = path.resolve(path.dirname(file), decoded);
  if (!resolved.startsWith(`${root}${path.sep}`) && resolved !== root) {
    errors.push(`${relative(file)}:${line}: local link leaves repository: ${target}`);
    return;
  }

  try {
    await access(resolved);
  } catch {
    errors.push(`${relative(file)}:${line}: broken local link: ${target}`);
  }
}

function verifyCommitExistsAndIsReachable(sha) {
  const exists = spawnSync('git', ['cat-file', '-e', `${sha}^{commit}`], {
    cwd: root,
    encoding: 'utf8',
  });

  if (exists.status !== 0) {
    errors.push(`docs/current-status.md: verification commit does not exist locally: ${sha}`);
    return;
  }

  const reachable = spawnSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  });

  if (reachable.status !== 0) {
    errors.push(`docs/current-status.md: verification commit is not reachable from HEAD: ${sha}`);
  }
}

const markdownFiles = [path.join(root, 'README.md'), ...await collectMarkdown(docsRoot)];
const forbidden = [
  { pattern: /\/v1\/resolve-address\b/i, label: 'legacy address endpoint' },
  { pattern: /repozytorium (?:jeszcze )?nie istnieje/i, label: 'obsolete missing-repository status' },
  { pattern: /nie użyto żadnego istniejącego repo/i, label: 'obsolete missing-repository status' },
  { pattern: /gotowe do przeniesienia do nowego repozytorium/i, label: 'obsolete repository-bootstrap status' },
  { pattern: /github blocker/i, label: 'obsolete GitHub blocker status' },
];

for (const file of markdownFiles) {
  const content = await readFile(file, 'utf8');
  const lines = content.split(/\r?\n/);
  const headings = new Map();
  let h1Count = 0;
  let inFence = false;

  for (const [index, value] of lines.entries()) {
    const line = index + 1;
    if (/^\s*```/.test(value)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const heading = value.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      if (heading[1] === '#') h1Count += 1;
      const key = `${heading[1].length}:${normalizeHeading(heading[2])}`;
      if (headings.has(key)) {
        errors.push(`${relative(file)}:${line}: repeated heading (first at line ${headings.get(key)}): ${heading[2]}`);
      } else {
        headings.set(key, line);
      }
    }

    for (const match of value.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      await checkLocalLink(file, match[1].trim().replace(/^<|>$/g, ''), line);
    }
  }

  const isCiLogFragment = /^docs\/ci-verification-note(?:-\d+)?\.md$/.test(relative(file));
  if (!isCiLogFragment && h1Count !== 1) {
    errors.push(`${relative(file)}: expected exactly one H1 heading, found ${h1Count}`);
  }

  for (const rule of forbidden) {
    const match = rule.pattern.exec(content);
    if (match) {
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      errors.push(`${relative(file)}:${line}: ${rule.label}`);
    }
  }
}

const driveEntries = (await readdir(path.join(docsRoot, 'google-drive'))).sort();
if (driveEntries.length !== 1 || driveEntries[0] !== 'README.md') {
  errors.push(`docs/google-drive: expected only README.md, found: ${driveEntries.join(', ')}`);
}

const currentStatus = await readFile(path.join(docsRoot, 'current-status.md'), 'utf8');
const verificationMatch = currentStatus.match(/> Zweryfikowano: \d{4}-\d{2}-\d{2}, commit `([0-9a-f]{40})`/);
if (!verificationMatch) {
  errors.push('docs/current-status.md: missing verification date and full commit SHA');
} else {
  verifyCommitExistsAndIsReachable(verificationMatch[1]);
}

if (errors.length > 0) {
  console.error('Documentation checks failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Documentation checks passed for ${markdownFiles.length} Markdown files.`);
