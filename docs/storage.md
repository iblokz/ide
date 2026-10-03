# Client storage

How preferences and related data are persisted across the supported hosts.

## Layers

| Layer | Format | Who reads it | Purpose |
|-------|--------|--------------|---------|
| **Electron user settings** | YAML in `userData` | Main process (before window) | Prefs that affect shell boot (e.g. single vs multi window) |
| **Renderer `localStorage`** | Browser API | Renderer | Theme, recent projects (works on web / Cap / Electron) |
| **Bundled defaults** | [`config/settings.yml`](../config/settings.yml) | Merged into user settings on first run | Documented defaults shipped with the app |

## Electron user settings (`settings.yml`)

On first Electron launch, defaults are copied to:

| Platform | Path |
|----------|------|
| **Linux** | `~/.config/iblokz-ide/settings.yml` |
| **macOS** | `~/Library/Application Support/iblokz-ide/settings.yml` |
| **Windows** | `%APPDATA%\iblokz-ide\settings.yml` |

Edit that file (File → **Open Settings File…**), then restart the app. User values override [`config/settings.yml`](../config/settings.yml).

### Keys (keep this list small)

| Key | Default | Meaning |
|-----|---------|---------|
| `windows.singleInstance` | `false` | `true` → second launch focuses the existing window; `false` → another window may open (pre-1.14 behavior) |

**Not here (yet):** theme, recent roots, per-project sessions, window bounds — those live in renderer `localStorage` (see below).

Implementation: [`electron/util/settings.js`](../electron/util/settings.js), wired from [`electron/main.js`](../electron/main.js).

## Renderer `localStorage`

| Key | Module | Contents |
|-----|--------|----------|
| `iblokz-ide-theme` | [`src/app/util/theme.js`](../src/app/util/theme.js) | Light / dark mode (`light` \| `dark`) |
| `iblokz-ide-recent-roots` | [`src/app/util/recent.js`](../src/app/util/recent.js) | Up to 8 recent project folders (`[{ id, name, path }, …]`) |
| `iblokz-ide-project-sessions` | [`src/app/util/session.js`](../src/app/util/session.js) | Per-project workspace session (see below) |

### Per-project sessions

Keyed by `project.path` (fallback `project.id`). Map is capped at 24 projects (LRU by `savedAt`).

| Field | Persisted | Notes |
|-------|-----------|--------|
| `layout.toggles` / `layout.dim` | yes | Preview open, sidebar widths, split ratios, … |
| `preview.mode` / `url` / `input` | yes | Not `reloadToken` |
| `tabPaths` + `activePath` | yes | Paths only (max 32); files re-read on restore |
| Buffer text / dirty / caret / scroll | **no** | Re-open from disk; unsaved edits are not restored |

On project open (`openFolder` / `openRecent`), layout + preview apply immediately; tabs restore asynchronously (missing files skipped). Debounced save (~300ms) while in workspace; flush on `beforeunload`.

**Web / FSA caveat:** after a full reload, directory handles are not restored yet — tab reopen by path works on Electron/Cap path backends; on web it only succeeds when the file node (handle) is already in the loaded tree.

### Not persisted yet

- Buffer contents, caret, scroll, dirty flags
- Window size / position
- File System Access handles (no IndexedDB permission restore yet)

## Where `localStorage` lands per platform

`localStorage` is scoped to an **origin** (scheme + host + port). The on-disk path is whatever that WebView / Chromium profile uses.

| Platform | Storage location |
|----------|------------------|
| **Web** | Browser profile for that origin (e.g. `http://127.0.0.1:1234`, or the GitHub Pages host for `/ide/`). Inspect via DevTools → Application → Local Storage. |
| **Electron Linux (AppImage)** | `~/.config/iblokz-ide/Local Storage/` (Chromium LevelDB under Electron `userData`) |
| **Electron macOS** | `~/Library/Application Support/iblokz-ide/Local Storage/` |
| **Electron Windows** (if packaged) | `%APPDATA%\iblokz-ide\Local Storage\` |
| **Android (Capacitor, `org.iblokz.ide`)** | App-private WebView data under `/data/data/org.iblokz.ide/` (not user-browsable without root / backup tools) |
| **iOS (Capacitor)** | App-sandbox WebKit storage for `org.iblokz.ide` |

Electron `userData` also holds diagnostics (`boot.log`, `renderer.log`) and **`settings.yml`**.

`appId` / Cap id: `org.iblokz.ide`. Electron profile directory name follows `package.json` `"name"` (`iblokz-ide`).

## Origin caveats (`localStorage` only)

Preferences in `localStorage` **do not** sync across different origins:

| Situation | Effect |
|-----------|--------|
| Electron **static** load (`file://` / packaged `dist`) vs **HMR** (`http://127.0.0.1:1234`, e.g. Cmd/Ctrl+Shift+H) | Separate `localStorage` partitions — theme / recents won’t match |
| Web **localhost:1234** vs deployed **Pages** host | Separate |
| Capacitor **live-reload** (LAN Parcel URL) vs **bundled** WebView | May differ by load URL |

Clearing site data / app data clears theme, recent roots, and project sessions for that origin only. Deleting `settings.yml` restores bundled Electron defaults on next launch.
