# Remote FS (SSH/SFTP)

**Idea:** a filesystem “engine” (backend) that opens a **project over SFTP**, so the tree/editor/save path talks to a remote host — phone or desktop as thin clients to a real machine.

**Approach:** [philosophy-pluggable](philosophy-pluggable.md) — another FS adapter beside local/Cap/web; same shell, different environment.

Names that fit: **SFTP workspace**, **SSH project provider**, **remote FS backend**. In code: likely `src/app/services/fs/sftp.js` with `access: 'sftp'`.

## Why it fits this codebase

Existing backends already share a contract:

- `openFolder` / optional `openFolderByPath`
- `listDir` / `readFile` / `writeFile` / `getObjectUrl`
- `canOpenFolder`, `canWrite`, `access`

See `electron`, `capacitor`, `web`, `memory` under `src/app/services/fs/`. An SFTP backend returns the same project shape; UI mostly unchanged.

## Architecture sketch

```
[tree / editor / save] → fs/sftp.js → SSH/SFTP client → host (LAN or internet)
```

Pair with [terminal panel](terminal-panel-and-termux.md): **same host profile**, SSH for shell + SFTP for files (one connection, two channels — or two sessions).

### Platform notes

| Host | SFTP client home |
|------|------------------|
| Electron | e.g. `ssh2` in main/preload |
| Android Cap | Native plugin (Java/Kotlin SSH lib) or shared native later |
| Plain web / GitHub Pages | No raw TCP — needs relay, or skip |

## Required design change: project-scoped FS

Today `detect()` picks **one global** backend (Electron → Cap → web). Remote open needs:

- Start screen: **Open folder** (local) vs **Open SSH/SFTP project…**
- `getFs()` = FS for **current project**, not only “platform default”

Without that, Electron can never open a remote project while local FS is selected.

## Caveats

| Topic | Note |
|--------|------|
| Latency | Chatty list/read/write — cache tree, debounce saves |
| File watch | No local chokidar; poll or remote notify later |
| Auth | Keys in secure storage; known_hosts / trust-on-first-use UX |
| Large / binary | Cap size or stream; reuse preview patterns carefully |
| Disconnect | Clear UX when SSH drops mid-edit |

## Milestone sketch

1. Electron: connect dialog → list/read/write one remote root  
2. Persist recent remote projects (host + path, not secrets in plain JSON carelessly)  
3. Share connection profiles with terminal SSH  
4. Capacitor plugin for BraX3 → edit projects on home PC over Wi‑Fi  

## Relation to other paths

- **Assistant:** can run on the remote host (Ollama on PC) while FS/terminal point at that PC — coherent “phone IDE, desk compute” story  
- **Cap Documents:** stays for offline/local scratch; SFTP for real repos  

---

**Back:** [Home](Home.md) · **See also:** [terminal](terminal-panel-and-termux.md), [assistant](assistant-offline-first.md)
