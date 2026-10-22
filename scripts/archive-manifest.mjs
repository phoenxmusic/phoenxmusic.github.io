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
const rootStat = await lstat(requestedRoot, { bigint: true });
if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error(`Archive root must be a real directory: ${requestedRoot}`);
// Canonicalize paths so a symlinked parent cannot make an apparently external
// manifest path resolve back into the archive and contaminate its inventory.
const root = await realpath(requestedRoot);
const canonicalRootStat = await lstat(root, { bigint: true });
if (!canonicalRootStat.isDirectory() || canonicalRootStat.isSymbolicLink() ||
    rootStat.dev !== canonicalRootStat.dev || rootStat.ino !== canonicalRootStat.ino) {
  throw new Error(`Archive root changed while its path was being resolved; retry with the archive idle: ${requestedRoot}`);
}
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
const directories = [];
const symlinks = [];

async function walk(directory, expectedIdentity = null) {
  const directoryBefore = await lstat(directory, { bigint: true });
  if (!directoryBefore.isDirectory() || directoryBefore.isSymbolicLink()) {
    throw new Error(`Archive directory was replaced or is not a real directory: ${directory}`);
  }
  if (expectedIdentity && (expectedIdentity.dev !== directoryBefore.dev || expectedIdentity.ino !== directoryBefore.ino)) {
    throw new Error(`Archive directory was replaced before inventory began; retry with the archive idle: ${directory}`);
  }
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if ((output && fullPath === output) || (verifyPath && fullPath === verifyPath)) continue;
    const info = await lstat(fullPath, { bigint: true });
    if (info.isSymbolicLink()) {
      symlinks.push(path.relative(root, fullPath).split(path.sep).join('/'));
      continue;
    }
    if (info.isDirectory()) {
      directories.push(path.relative(root, fullPath).split(path.sep).join('/'));
      await walk(fullPath, info);
      continue;
    }
    if (!info.isFile()) {
      throw new Error(`Unsupported filesystem object in archive; only regular files and directories are accepted: ${fullPath}`);
    }
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
  const directoryAfter = await lstat(directory, { bigint: true });
  if (!directoryAfter.isDirectory() || directoryAfter.isSymbolicLink() ||
      directoryBefore.dev !== directoryAfter.dev || directoryBefore.ino !== directoryAfter.ino ||
      directoryBefore.mtimeNs !== directoryAfter.mtimeNs || directoryBefore.ctimeNs !== directoryAfter.ctimeNs) {
    throw new Error(`Archive directory changed while being inventoried; retry with the archive idle: ${directory}`);
  }
}

await walk(root, canonicalRootStat);
files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
directories.sort((a, b) => a.localeCompare(b, 'en'));
if (symlinks.length) {
  console.error(`ERROR: ${symlinks.length} symbolic link(s) found. Resolve them explicitly before treating this as a complete archive manifest.`);
  for (const link of symlinks) console.error(`SYMLINK ${link}`);
  process.exit(1);
}

const manifest = { format: 'phoenx-archive-manifest-v2', hash_algorithm: 'SHA-256', root_label: path.basename(root), file_count: files.length, directory_count: directories.length, total_size_bytes: files.reduce((sum, item) => sum + item.size_bytes, 0), directories, files };
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
    path.posix.normalize(item.path) === item.path && !/[\u0000-\u001f\u007f]/.test(item.path) &&
    Number.isSafeInteger(item.size_bytes) && item.size_bytes >= 0 &&
    typeof item.sha256 === 'string' && /^[a-f0-9]{64}$/.test(item.sha256));
  const paths = validFileEntries ? expected.files.map(item => item.path) : [];
  const computedTotal = validFileEntries ? expected.files.reduce((sum, item) => sum + item.size_bytes, 0) : NaN;
  const validDirectoryEntries = Array.isArray(expected.directories) && expected.directories.every(item =>
    typeof item === 'string' && item.length > 0 &&
    !path.posix.isAbsolute(item) && !item.includes('\\') &&
    item.split('/').every(part => part !== '' && part !== '.' && part !== '..') &&
    path.posix.normalize(item) === item && !/[\u0000-\u001f\u007f]/.test(item));
  const directoryPaths = validDirectoryEntries ? expected.directories : [];
  const directorySet = new Set(directoryPaths);
  const hasAllParents = itemPath => {
    const parts = itemPath.split('/');
    for (let index = 1; index < parts.length; index++) {
      if (!directorySet.has(parts.slice(0, index).join('/'))) return false;
    }
    return true;
  };
  const validTreeLayout = validDirectoryEntries && validFileEntries &&
    directoryPaths.every(item => hasAllParents(item)) &&
    expected.files.every(item => !directorySet.has(item.path) && hasAllParents(item.path));
  if (expected.format !== 'phoenx-archive-manifest-v2' || expected.hash_algorithm !== 'SHA-256' ||
      typeof expected.root_label !== 'string' || expected.root_label.length === 0 ||
      /[\u0000-\u001f\u007f]/.test(expected.root_label) ||
      !validFileEntries || new Set(paths).size !== paths.length ||
      !validDirectoryEntries || new Set(expected.directories).size !== expected.directories.length ||
      !validTreeLayout ||
      expected.directory_count !== expected.directories.length ||
      expected.file_count !== expected.files.length ||
      !Number.isSafeInteger(computedTotal) || expected.total_size_bytes !== computedTotal) {
    throw new Error(`Unsupported or malformed archive manifest: ${verifyPath}`);
  }
  const byPath = new Map(files.map(item => [item.path, item]));
  const expectedByPath = new Map(expected.files.map(item => [item.path, item]));
  const problems = [];
  const actualDirectories = new Set(directories);
  const expectedDirectories = new Set(expected.directories);
  for (const directory of expected.directories) {
    if (!actualDirectories.has(directory)) problems.push(`MISSING DIRECTORY ${directory}`);
  }
  for (const directory of directories) {
    if (!expectedDirectories.has(directory)) problems.push(`UNEXPECTED DIRECTORY ${directory}`);
  }
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
  console.log(`VERIFY PASSED: ${files.length} files and ${directories.length} directories match the manifest (${manifest.total_size_bytes} file bytes; SHA-256 hashes and sizes verified).`);
} else if (output) {
  await writeFile(output, json, { encoding: 'utf8', flag: 'wx' });
  console.log(`Wrote ${path.relative(process.cwd(), output)}: ${files.length} files, ${directories.length} directories, ${manifest.total_size_bytes} file bytes; ${manifest.inventory_summary.zero_byte_files.length} zero-byte files; ${duplicateContent.length} duplicate-content groups.`);
} else {
  console.log(`Read-only inventory: ${files.length} files, ${directories.length} directories, ${manifest.total_size_bytes} file bytes. No files written.`);
  console.log(`Categories: ${Object.entries(manifest.inventory_summary.category_counts).map(([category, count]) => `${category}=${count}`).join(', ') || 'none'}`);
  console.log(`Zero-byte files: ${manifest.inventory_summary.zero_byte_files.length}; duplicate-content groups: ${duplicateContent.length}; symlinks: ${symlinks.length}.`);
  for (const item of files) console.log(`${item.sha256}  ${item.size_bytes}  ${item.path}`);
}
