import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const SCAN_TARGETS = ['app', 'src', 'scripts', 'docs', 'README.md'];
const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.md']);
const SKIPPED_FILES = new Set([
  path.resolve(ROOT_DIR, 'scripts', 'audit.mjs'),
  path.resolve(ROOT_DIR, 'docs', 'PROJECT_RULES.md'),
]);

const FAIL_RULES = [
  {
    regex: /[\u2013\u2014]/,
    reason: 'em dash or en dash character',
  },
  {
    regex: /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|\u20E3/u,
    reason: 'emoji character',
  },
  {
    regex: /\blorem\s+ipsum\b/i,
    reason: 'lorem ipsum placeholder text',
  },
  {
    regex: /\bconsole\.log\s*\(/,
    reason: 'console.log call',
  },
  {
    regex: /LinearGradient|linear-gradient/i,
    reason: 'gradient usage',
  },
  {
    regex: /\b(?:made|built|created|generated|written|powered)\s+(?:with|by)\s+ai\b/i,
    reason: 'AI attribution text',
  },
  {
    regex: /\b(?:TODO|FIXME)\b/,
    reason: 'TODO or FIXME marker',
  },
];

const BORDER_RADIUS_REGEX =
  /\bborder(?:TopLeft|TopRight|BottomLeft|BottomRight|StartStart|StartEnd|EndStart|EndEnd)?Radius\s*[:=]\s*(\d+(?:\.\d+)?)/g;

function collectFiles(targetPath, seen, files) {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    const baseName = path.basename(targetPath);
    if (baseName === 'node_modules' || baseName === '.git') {
      return;
    }
    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    for (const entry of entries) {
      collectFiles(path.join(targetPath, entry.name), seen, files);
    }
    return;
  }

  const resolved = path.resolve(targetPath);
  if (seen.has(resolved) || SKIPPED_FILES.has(resolved)) {
    return;
  }

  const ext = path.extname(resolved).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return;
  }

  seen.add(resolved);
  files.push(resolved);
}

function toDisplayPath(filePath) {
  return path.relative(ROOT_DIR, filePath).split(path.sep).join('/');
}

function main() {
  const seen = new Set();
  const files = [];

  for (const target of SCAN_TARGETS) {
    collectFiles(path.resolve(ROOT_DIR, target), seen, files);
  }

  files.sort((a, b) => toDisplayPath(a).localeCompare(toDisplayPath(b)));

  let problems = 0;

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    const relPath = toDisplayPath(filePath);

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const lineNum = i + 1;

      for (const rule of FAIL_RULES) {
        if (rule.regex.test(line)) {
          process.stdout.write(`FAIL ${relPath}:${lineNum} ${rule.reason}\n`);
          problems += 1;
        }
      }

      BORDER_RADIUS_REGEX.lastIndex = 0;
      let match = BORDER_RADIUS_REGEX.exec(line);
      while (match !== null) {
        const value = Number(match[1]);
        if (value > 16) {
          process.stdout.write(
            `REVIEW ${relPath}:${lineNum} borderRadius ${value}\n`
          );
        }
        match = BORDER_RADIUS_REGEX.exec(line);
      }
    }
  }

  if (problems === 0) {
    process.stdout.write('audit passed\n');
  } else {
    process.stdout.write(
      `${problems} problem${problems === 1 ? '' : 's'} found\n`
    );
    process.exitCode = 1;
  }
}

main();
