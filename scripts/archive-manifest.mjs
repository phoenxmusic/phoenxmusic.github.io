#!/usr/bin/env node
// Create a portable SHA-256 inventory for an archive directory using Node's built-in modules.
// Default is read-only: print a summary. Use --write PATH to save the JSON manifest.
// Symlinks are rejected rather than silently followed, and no source files are modified.
import { createHash } from 'node:crypto';
import { readdir, readFile, lstat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const rootArg = args.find(arg => !arg.startsWith('--'));
const writeIndex = args.indexOf('--write');
const outputArg = writeIndex >= 0 ? args[writeIndex + 1] : null;
if (!rootArg || (writeIndex >= 0 && (!outputArg || outputArg.startsWith('--')))) {
  console.error('Usage: node scripts/archive-manifest.mjs <archive-directory> [--write <manifest.json>]');
  process.exit(2);
}

const root = path.resolve(rootArg);
const rootStat = await lstat(root);
if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error(`Archive root must be a real directory: ${root}`);
const output = outputArg ? path.resolve(outputArg) : null;
const files = [];
const symlinks = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (output && fullPath === output) continue;
    const info = await lstat(fullPath);
    if (info.isSymbolicLink()) {
      symlinks.push(path.relative(root, fullPath).split(path.sep).join('/'));
      continue;
    }
    if (info.isDirectory()) {
      await walk(fullPath);
      continue;
    }
    if (!info.isFile()) continue;
    const bytes = await readFile(fullPath);
    files.push({ path: path.relative(root, fullPath).split(path.sep).join('/'), size_bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
}

await walk(root);
files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
if (symlinks.length) {
  console.error(`ERROR: ${symlinks.length} symbolic link(s) found. Resolve them explicitly before treating this as a complete archive manifest.`);
  for (const link of symlinks) console.error(`SYMLINK ${link}`);
  process.exit(1);
}

const manifest = { format: 'phoenx-archive-manifest-v1', hash_algorithm: 'SHA-256', root_label: path.basename(root), file_count: files.length, total_size_bytes: files.reduce((sum, item) => sum + item.size_bytes, 0), files };
const json = `${JSON.stringify(manifest, null, 2)}\n`;
if (output) {
  await writeFile(output, json, { encoding: 'utf8', flag: 'wx' });
  console.log(`Wrote ${path.relative(process.cwd(), output)}: ${files.length} files, ${manifest.total_size_bytes} bytes.`);
} else {
  console.log(`Read-only inventory: ${files.length} files, ${manifest.total_size_bytes} bytes. No files written.`);
  for (const item of files) console.log(`${item.sha256}  ${item.size_bytes}  ${item.path}`);
}
