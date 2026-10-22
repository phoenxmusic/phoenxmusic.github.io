# PhoenX archive intake and backup verification

This procedure is for the **real source archive**, not the generated website. The source archive's location has not yet been confirmed in the DevSpace workspace. Do not substitute the Git repository, the WordPress export, or the website for the original master files.

## Safety rules

- Do not rename, move, delete, normalize, or edit files in the source archive.
- Do not use mirroring/synchronization commands that can delete destination files.
- Keep manifests and reports outside the directory being inventoried. Store at least one copy separately from the archive and its backup disks.
- Do not regard duplicate hashes as permission to delete a file. Identical files may be intentional copies in different project folders.
- Keep private, unreleased, or rights-unclear material private; a checksum inventory does not authorize publication.
- Run the inventory while the source archive is idle. If a file changes while hashing, stop and repeat after writes have ceased.

## Intake steps

1. **Identify the source.** Record the exact folder path, device/volume, approximate size, owner, and date. Confirm with the owner that it is the intended archive. Never guess the path.
2. **Record the starting state.** In PowerShell, inspect the selected path without changing it:

   ```powershell
   Get-Item -LiteralPath 'X:\CONFIRMED\SOURCE\MUSIC-LEGACY' |
     Select-Object FullName, Attributes, LastWriteTime
   Get-ChildItem -LiteralPath 'X:\CONFIRMED\SOURCE\MUSIC-LEGACY' -Force |
     Select-Object Name, Mode, Length, LastWriteTime
   ```

   Replace the example path only after confirming the real location. This top-level listing is a quick check, not a complete inventory.

3. **Generate a baseline manifest.** Run from the PhoenX repository in the DevSpace workspace, only after the source directory is actually accessible there:

   ```powershell
   node scripts/archive-manifest.mjs 'X:\CONFIRMED\SOURCE\MUSIC-LEGACY' --write 'Y:\SEPARATE\PhoenX-backup-records\source-manifest.json'
   ```

   The output path must be new; the tool refuses to overwrite it. Use a separate, trusted destination for the manifest. If the real archive cannot be accessed from DevSpace, do not run a substitute inventory and do not claim the archive was inventoried.

4. **Make copies using a separately chosen, non-destructive copy procedure.** Copy to two independent destinations, ideally on different storage types, with one copy geographically separate. Keep one physical copy disconnected when not updating it. Do not delete the source or either copy after copying.

5. **Verify each copy against the same baseline manifest.** For each copy, use its own path and the unchanged manifest:

   ```powershell
   node scripts/archive-manifest.mjs 'Z:\BACKUP-1\MUSIC-LEGACY' --verify 'Y:\SEPARATE\PhoenX-backup-records\source-manifest.json'
   node scripts/archive-manifest.mjs 'W:\BACKUP-2\MUSIC-LEGACY' --verify 'Y:\SEPARATE\PhoenX-backup-records\source-manifest.json'
   ```

   A pass means file paths, sizes, SHA-256 hashes, and directory layout match the manifest. Empty directories are recorded too. The tool fails closed on symbolic links and on filesystem objects that are neither regular files nor directories; it does not silently omit them. A failure must be investigated; do not overwrite the baseline manifest to make the check pass.

   The manifest also binds verification to the archive's root directory name. Keep the source and both backup directory basenames identical (as in the examples above); if a backup must use a different name, stop and deliberately create and document a separate baseline for that named copy rather than weakening the identity check.

6. **Test restoreability.** Restore a representative selection—and eventually a complete copy—into a new, empty test location. Verify the restored copy against the baseline manifest. Open/play representative audio and video files using appropriate software; checksums alone do not establish that files are playable or complete.

7. **Record evidence.** Keep the manifest, verification output, copy dates, device/location identifiers, exceptions, and restore-test results. Avoid placing private file contents or sensitive personal data in a public repository.

## Completion criteria

- The actual source path and scope are confirmed.
- A baseline manifest was generated from that source and stored separately.
- At least two independent copies exist in addition to the source, and each verifies against the baseline.
- A restore test is documented.
- Any missing files, unreadable media, symlinks, unsupported filesystem objects, zero-byte files, or unexpected differences are explicitly tracked.

**Current status:** Not yet completed. The actual source archive has not been exposed to this DevSpace workspace, and no real-archive inventory, backup verification, or restore test is claimed.

## Evidence log template

Create one dated copy of this record for each intake or verification session. Keep the completed record beside the manifests in a private backup-records location; do not commit real archive paths, personal details, or unreleased track names to the public website repository.

```text
PhoenX archive preservation session
Session date/time and time zone:
Operator:
Scope confirmed by archive owner (yes/no; details):
Source device/volume identifier:
Source path (private record only):
Source top-level item count and approximate size:
Source idle before hashing (yes/no):
Inventory command and tool/repository commit:
Manifest storage location and SHA-256 of manifest:
Inventory result (file count / directory count / total bytes / zero-byte files / symlinks / unsupported objects):
Backup 1 device/location and copy date:
Backup 1 verification result and output location:
Backup 2 device/location and copy date:
Backup 2 verification result and output location:
Restore-test destination and selection/scope:
Restore-test verification result:
Representative media playback test results:
Exceptions, unreadable files, or unexplained differences:
Follow-up owner and next action:
Session outcome: INCOMPLETE / VERIFIED WITH EXCEPTIONS / VERIFIED
```

Use `VERIFIED` only when all completion criteria above are met. A successful manifest-generation command alone is not proof that backups exist or can be restored. Preserve raw command output for each verification, and never replace an earlier manifest to conceal a mismatch.
