# Security

DarkText is an **offline desktop app**. Your manuscripts live in a normal folder on disk. There is no account, no sync service, and no runtime connection to author-controlled servers.

## Threat model

DarkText is designed to protect against:

- A compromised or malicious **frontend** invoking Rust commands against paths you did not open
- **Path traversal** when reading library files or assets
- **Unsafe HTML** in chapter files (including libraries edited outside the app)
- **Unexpected network requests** from embedded remote image URLs

DarkText is **not** designed to stop you from opening a library folder you chose, exporting files to a path you chose, or importing fonts/images you selected in the system file dialog. Those are intentional local actions.

## How access is controlled

### Active library

Most commands that take a `library_path` call `require_active_library`. The Rust backend keeps one canonical open library; IPC requests for any other path are rejected.

### Path containment

- Chapter and snapshot IDs reject `.`, `..`, separators, and null bytes.
- `read_file_bytes` resolves paths with `canonicalize` and ensures they stay inside the open library.
- Export output directories are canonicalized; export filenames are sanitized.

### WebView / HTML

- Content Security Policy: scripts only from `'self'`; no `unsafe-eval`.
- Remote `http://` / `https://` image and link URLs are stripped when chapter HTML is loaded.
- Library images use the `asset://` protocol for files under your library `images/` folder.
- Read-through preview runs HTML through a sanitizer before display.

### Capabilities

Tauri capabilities are limited to the main window, dialogs, and basic window controls. There is no broad filesystem permission scope.

## Reporting a vulnerability

Use GitHub private vulnerability reporting on this repository. Include the DarkText version, steps to reproduce, and impact (data loss, path escape, unexpected network, etc.).


Please do not open public GitHub issues for undisclosed security bugs.

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |
| < 0.1   | No        |

## Building from source

If you build DarkText yourself, use dependencies from `package-lock.json` and `Cargo.lock`. Run `npm run test:ci` before shipping a custom build.