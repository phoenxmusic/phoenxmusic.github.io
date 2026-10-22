#!/usr/bin/env node
// Create a portable SHA-256 inventory for an archive directory using Node's built-in modules.
// Default is read-only: print a summary. Use --write PATH to save the JSON manifest.
// Symlinks are rejected rather than silently followed, and no source files are modified.
import { createHash } from 'node:crypto';
import { readdir, readFile, lstat, realpath, writeFile, open } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const rootArg = args[0];
const mode = args.length > 1 ? args[1] : null;
const targetArg = args.length > 1 ? args[2] : null;
const outputArg = mode === '--write' ? targetArg : null;
const verifyArg = mode === '--verify' ? targetArg : null;
if (!rootArg || rootArg.startsWith('--') ||
    (args.length !== 1 && args.length !== 3) ||
    (args.length === 3 && !['--write', '--verify'].includes(mode)) ||
    (args.length === 3 && (!targetArg || targetArg.startsWith('--')))) {
  console.error('Usage: node scripts/archive-manifest.mjs <archive-directory> [--write <manifest.json> | --verify <manifest.json>]');
  process.exit(2);
}

const requestedRoot = path.resolve(rootArg);
const rootStat = await lstat(requestedRoot);
if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error(`Archive root must be a real directory: ${requestedRoot}`);
// Canonicalize paths so a symlinked parent cannot make an apparently external
// manifest path resolve back into the archive and contaminate its inventory.
const root = await realpath(requestedRoot);
const canonicalTarget = async target => {
  if (!target) return null;
  const absolute = path.resolve(target);
  try {
    // Resolve the final component too when it already exists, including file
    // symlinks. Otherwise a manifest symlink could bypass the archive boundary.
    return await realpath(absolute);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return path.resolve(await realpath(path.dirname(absolute)), path.basename(absolute));
  }
};
const output = await canonicalTarget(outputArg);
const verifyPath = await canonicalTarget(verifyArg);
const isWithinRoot = candidate => {
  if (!candidate) return false;
  const relative = path.relative(root, candidate);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
};
if (isWithinRoot(output) || isWithinRoot(verifyPath)) {
  throw new Error('Manifest input/output must be stored outside the archive directory.');
}
const files = [];
const symlinks = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if ((output && fullPath === output) || (verifyPath && fullPath === verifyPath)) continue;
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
    // Hash an open handle so a path replacement cannot silently switch the
    // file being read. Compare handle metadata and the final path identity too.
    // Streaming keeps large WAV/video masters out of RAM.
    const handle = await open(fullPath, 'r');
    try {
      const before = await handle.stat({ bigint: true });
      const hash = createHash('sha256');
      let sizeBytes = 0;
      for await (const chunk of handle.createReadStream({ autoClose: false })) {
        hash.update(chunk);
        sizeBytes += chunk.length;
      }
      const after = await handle.stat({ bigint: true });
      // lstat is intentional: stat would follow a symlink substituted after
      // the directory walk and could make an external target look like the
      // original in-archive file.
      const pathAfter = await lstat(fullPath, { bigint: true });
      if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size ||
          before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs ||
          pathAfter.isSymbolicLink() || !pathAfter.isFile() ||
          after.dev !== pathAfter.dev || after.ino !== pathAfter.ino ||
          BigInt(sizeBytes) !== after.size) {
        throw new Error(`File changed while being inventoried; retry with the archive idle: ${fullPath}`);
      }
      files.push({ path: path.relative(root, fullPath).split(path.sep).join('/'), size_bytes: sizeBytes, sha256: hash.digest('hex') });
    } finally {
      await handle.close();
    }
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
const mediaCategory = filename => {
  const ext = path.extname(filename).toLowerCase();
  if (['.wav', '.flac', '.aiff', '.aif', '.mp3', '.m4a', '.aac', '.ogg', '.opus', '.wma'].includes(ext)) return 'audio';
  if (['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v', '.wmv'].includes(ext)) return 'video';
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tif', '.tiff', '.bmp', '.heic', '.avif', '.svg'].includes(ext)) return 'image';
  if (['.zip', '.7z', '.rar', '.tar', '.gz', '.bz2', '.xz'].includes(ext)) return 'archive';
  return 'other';
};
const countBy = keyFn => Object.fromEntries([...files.reduce((counts, item) => {
  const key = keyFn(item);
  counts.set(key, (counts.get(key) || 0) + 1);
  return counts;
}, new Map())].sort(([a], [b]) => a.localeCompare(b, 'en')));
const hashes = new Map();
for (const item of files) {
  if (!hashes.has(item.sha256)) hashes.set(item.sha256, []);
  hashes.get(item.sha256).push(item.path);
}
const duplicateContent = [...hashes].filter(([, paths]) => paths.length > 1).map(([sha256, paths]) => ({ sha256, paths }));
manifest.inventory_summary = {
  category_counts: countBy(item => mediaCategory(item.path)),
  extension_counts: countBy(item => path.extname(item.path).toLowerCase() || '[no extension]'),
  zero_byte_files: files.filter(item => item.size_bytes === 0).map(item => item.path),
  duplicate_content_groups: duplicateContent,
  note: 'Extension-based categories are provisional. Duplicate hashes identify byte-identical files, not necessarily unnecessary copies.'
};
const json = `${JSON.stringify(manifest, null, 2)}\n`;
if (verifyPath) {
  let expected;
  try {
    expected = JSON.parse(await readFile(verifyPath, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`Manifest is not valid JSON: ${verifyPath}`);
    throw error;
  }
  if (!expected || typeof expected !== 'object' || Array.isArray(expected)) {
    throw new Error(`Unsupported or malformed archive manifest: ${verifyPath}`);
  }
  const validFileEntries = Array.isArray(expected.files) && expected.files.every(item =>
    item && typeof item.path === 'string' && item.path.length > 0 &&
    !path.posix.isAbsolute(item.path) && !item.path.includes('\\') &&
    item.path.split('/').every(part => part !== '' && part !== '.' && part !== '..') &&
    path.posix.normalize(item.path) === item.path && !/[\u0000-\u001f]/.test(item.path) &&
    Number.isSafeInteger(item.size_bytes) && item.size_bytes >= 0 &&
    typeof item.sha256 === 'string' && /^[a-f0-9]{64}$/.test(item.sha256));
  const paths = validFileEntries ? expected.files.map(item => item.path) : [];
  const computedTotal = validFileEntries ? expected.files.reduce((sum, item) => sum + item.size_bytes, 0) : NaN;
  if (expected.format !== 'phoenx-archive-manifest-v1' || expected.hash_algorithm !== 'SHA-256' ||
      !validFileEntries || new Set(paths).size !== paths.length ||
      expected.file_count !== expected.files.length ||
      !Number.isSafeInteger(computedTotal) || expected.total_size_bytes !== computedTotal) {
    throw new Error(`Unsupported or malformed archive manifest: ${verifyPath}`);
  }
  const byPath = new Map(files.map(item => [item.path, item]));
  const expectedByPath = new Map(expected.files.map(item => [item.path, item]));
  const problems = [];
  for (const item of expected.files) {
    const actual = byPath.get(item.path);
    if (!actual) problems.push(`MISSING ${item.path}`);
    else {
      if (actual.size_bytes !== item.size_bytes) problems.push(`SIZE ${item.path}: expected ${item.size_bytes}, got ${actual.size_bytes}`);
      if (actual.sha256 !== item.sha256) problems.push(`HASH ${item.path}: SHA-256 differs`);
    }
  }
  for (const item of files) if (!expectedByPath.has(item.path)) problems.push(`UNEXPECTED ${item.path}`);
  if (problems.length) {
    console.error(`VERIFY FAILED: ${problems.length} difference(s); ${expected.files.length} expected file(s), ${files.length} found.`);
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
  console.log(`VERIFY PASSED: ${files.length} files match manifest SHA-256 hashes and sizes (${manifest.total_size_bytes} bytes).`);
} else if (output) {
  await writeFile(output, json, { encoding: 'utf8', flag: 'wx' });
  console.log(`Wrote ${path.relative(process.cwd(), output)}: ${files.length} files, ${manifest.total_size_bytes} bytes; ${manifest.inventory_summary.zero_byte_files.length} zero-byte files; ${duplicateContent.length} duplicate-content groups.`);
} else {
  console.log(`Read-only inventory: ${files.length} files, ${manifest.total_size_bytes} bytes. No files written.`);
  console.log(`Categories: ${Object.entries(manifest.inventory_summary.category_counts).map(([category, count]) => `${category}=${count}`).join(', ') || 'none'}`);
  console.log(`Zero-byte files: ${manifest.inventory_summary.zero_byte_files.length}; duplicate-content groups: ${duplicateContent.length}; symlinks: ${symlinks.length}.`);
  for (const item of files) console.log(`${item.sha256}  ${item.size_bytes}  ${item.path}`);
}
