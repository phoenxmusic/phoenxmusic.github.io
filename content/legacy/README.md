# Archive inventory

This folder holds inventory templates and documentation, not master audio files. Do not upload large master files or credentials to the public website repository.

Before filling the inventory, locate the actual files and record their existing locations. Do not move, rename, delete, or alter source files during the first pass. Keep private account recovery details out of this repository.

For each asset, record a stable asset ID, associated release if known, asset type, original filename, format, source location, rights/permission status, and backup verification. Use `unknown` rather than guessing. Generate SHA-256 hashes with `scripts/archive-manifest.mjs` against the real archive directory, then retain a copy of the manifest in the archive itself and another independent location.

The CSV template is not evidence that any particular asset exists or has been backed up.
