# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### (none)

---

## [1.13.0] - 2026-08-31

### Added

- Find: collapsed search icon in the editor top-right (semi-transparent until hover); expands to the find bar; close / Escape collapses back to the icon
- `start.sh`: combinable `--electron` / `--android` / `--ios` on one shared Parcel host
- Init / deploy: require Java 17+ for Android (auto-pick a suitable JDK when installed); Linux `plugdev` alert + hard check on USB adb deploy

### Changed

- `start.sh` / `pnpm start`: always bind Parcel on `0.0.0.0:1234` for web, desktop, and mobile clients; platform flags only attach shells
- Find bar: softer match-line wash; search icon aligns with the close control

### Removed

- In-memory demo project (`Open Demo`, `DEMO_TREE`, `openDemo`) — start screen opens a real project / recent folder only

---

## [1.12.0] - 2026-08-31

### Added

- In-document find: floating find bar (`Mod+F`), live search on plain `state.source`, next/prev (`Enter` / `F3`), match case, `Tab` to select the match in the editor
- `Mod+O` → open folder; hotkeys service supports non-toggle actions (`openFolder`, `openFind`)

### Changed

- Find: live query always jumps to the first match (avoids jumping on every keystroke); `Mod+F` with a selection pre-fills the search string and highlights that occurrence
- Find highlight: subtle row wash + CSS Highlight API (or `<mark>` fallback) for the match range while the find bar keeps keyboard focus

---

## [1.11.0] - 2026-08-31

### Added

- Prettify post-pass: highlight call/method callees (`.fun`) and destructured bindings (`.var`) for JS/TS

### Changed

- `ext/prettify-js` converted to ESM; destructured-binding token color aligned to cyan

---

## [1.10.1] - 2026-08-31

### Added

- Custom code-prettify JS/TS handler (`iblokz-js`): template literals, modern keywords, no C false-positives

### Fixed

- Stage layout SVG icons into `src/assets` so Parcel resolves Sass `mask-image` urls
- Electron: disable Chromium spellchecker on the BrowserWindow (contenteditable `spellcheck=false` was not enough)
- File tree: re-expand prior folders after FS refresh (`onFsChange`) instead of collapsing to a shallow listing
- HMR: unsubscribe Electron `onFsChange` on dispose so refresh listeners do not stack

### Changed

- Scrollbars: dim thumb until the scroll container is hovered or focus-within
- Prettify theme: stronger punctuation + `.atn` / `.dec` / `.var` / `.fun` token colors

---

## [1.10.0] - 2026-08-24

### Added

- Keyboard shortcuts service: `config/hotkeys.yml` + RxJS `keydown` handler for layout toggles
- Platform util (`runtime`, `os`, `deviceType`, `browser`, `modKey` / `modKeyLabel`, Electron/Capacitor detection)
- Hotkey util: platform-aware labels from YAML chords (`Ctrl+Shift+B` vs macOS `⇧⌘B`)

### Changed

- Layout menu hotkey column driven from `hotkeys.yml` (no hardcoded `Ctrl+…` strings)
- Electron / Capacitor / browser checks consolidated in `util/platform.js`
- Add `@parcel/transformer-yaml` for hotkey config bundling

---

## [1.9.0] - 2026-08-23

### Added

- Boilerplate-style theme pipeline (`theme/registry` → emit → mixins → components) with IDE light/dark family tokens (`.theme-ide-*` + `.theme-mode-*` for chrome like prettify/scrollbars)
- Layout state submodule (`toggles` / `dim`) and header layout menu (left/right side bar, bottom panel, preview) with SVG icons and hotkey labels
- Shared dropdown component for header chrome
- Syntax highlighting: depend on `github:iblokz/code-prettify`; map common file extensions and load CSS/YAML handlers; console logs use `json` lang

### Fixed

- Split gutters on touch: `touch-action: none`, wider hit target, commit last move delta on `pointercancel` so short drags no longer snap back
- Opening a folder keeps other layout toggles when forcing the left sidebar open (`state.layout.toggles`, not a missing top-level `toggles`)

### Changed

- UI prep prefers compositional `fn.pipe` / `[].concat` conditional children (documented preference in `.cursor/rules`)
- Drop panes cycle helpers and `util/layout.js`; layout defaults live in `state/layout` (persistence deferred to Phase 2 — see `planning/`)

---

## [1.8.2] - 2026-08-16

### Fixed

- CI / Cap Android: commit `@iblokz/scoped-folder` native sources (gitignore had been matching nested `android`/`ios`/`dist`, so CI only had the package stub)

---

## [1.8.1] - 2026-08-16

### Fixed

- Capacitor packaged Android/iOS: keep `<head>` in Parcel’s minified `index.html` so the native bridge can inject (Open Project / plugins were dead in build+deploy while live-reload worked)

---

## [1.8.0] - 2026-08-16

### Changed

- Capacitor Android/iOS: Open Project uses the system folder picker (SAF / document picker) instead of a fixed Documents/`iblokz-ide` workspace; cancel leaves the start screen

### Fixed

- Capacitor: re-detect FS backend after the native bridge is ready so Open Project uses SAF/`ScopedFolder` instead of the web directory input (which does nothing in the Android WebView)
- Capacitor Android: request legacy storage permission before the folder picker (API ≤32), and detect native via `androidBridge` so live-reload builds call `ScopedFolder.pickFolder`
- Android start/build: prefetch the Gradle wrapper zip with visible progress — Capacitor’s “Running Gradle build” spinner was hiding the ~200MB first-time download
- `start.sh`: recover from Parcel SIGABRT (corrupt `.parcel-cache` / LMDB mutex) by clearing the cache and retrying up to 3 times

---

## [1.7.1] - 2026-08-04

### Fixed

- Android Cap 5 / JDK 21: bump Gradle wrapper to 8.5 after `cap add` (template 8.0.2 cannot run on Java 21)
- Android Cap 5 / JDK 21: bump AGP to 8.2.2 after `cap add` (AGP 8.0 `androidJdkImage` / jlink failure)

---

## [1.7.0] - 2026-08-04

### Added

- macOS Electron DMG packaging (`./bin/build.sh --macos`), unsigned; run target macOS 11+ (Electron 33)
- Capacitor iOS init/start/build/deploy (Simulator zip; unsigned CI smoke)
- Capability-gated `--all` on init/build/deploy (skip missing toolchains with a message)
- Init prints an upfront OS-dependency report (`[ok]` / `[missing]`) with MacPorts/Homebrew/apt install hints
- Init is scaffold-only: `cap add` android/ios if missing; no `build:cap` / `dist/` (build/start create those)
- Dev Electron sets the macOS Dock icon via `app.dock.setIcon` (BrowserWindow `icon` is ignored there)
- `deploy --macos` installs `.app` (or from `.dmg`) into `~/Applications`, parallel to AppImage → `~/.local`
- Deploy installs only (no start fallback); prompts to build missing artifacts on a TTY (or pass `--build`)
- Generate macOS `icon.icns` via `iconutil` for Spotlight/Finder (avoid broken electron-builder PNG→icns)
- Init detects missing Xcode CoreSimulator (first-launch packages) for iOS and prints `xcodebuild -runFirstLaunch` hints
- iOS capability check requires Xcode 14.1+ (Capacitor 5)
- MacPorts-first install hints for JDK, adb, ImageMagick, CocoaPods
- CI: universal macOS DMG + iOS Simulator zip on `macos-latest`

### Changed

- Capacitor stack pinned to **5.7.x** (Xcode 14.1+) so Monterey / Xcode 14.2 can build and deploy iOS Simulator locally
- iOS deploy extracts simulator UDIDs by UUID (names like `iPhone SE (3rd generation)` broke `awk` on parentheses)
- Linux AppImage packaging flag renamed to `--app-image` (`--electron` remains for the desktop shell; deprecated as a packaging alias)
- `dist:electron` → `dist:app-image`; added `dist:macos`, `start:macos` / `start:ios`, `init:macos` / `init:ios`

### Fixed

- Packaged Electron white screen: clear Parcel cache before `public-url ./` builds (avoid stale absolute `/` asset URLs)

---

## [1.6.1] - 2026-07-26

### Added

- Empty editor placeholder when a project is open but no file is selected
- Documented release order (bump → commit → tag) in `docs/RELEASE.md` and `.cursor/rules/releases.mdc`

### Fixed

- Header title rendering `undefined` on the start screen
- `package.json` version now matches the release tag so AppImage/APK names stay in sync

### Changed

- Opening / switching real projects clears the open file (demo still opens Untitled.js)

---

## [1.6.0] - 2026-07-26

### Added

- Start screen: open project, recent list, and open in-memory demo (no longer boots into the demo editor)
- Electron recent reopen by path (`openRootFolder` / `openFolderByPath`)
- README logo in the title

### Changed

- Native artifact names share one pattern: `iblokz-ide-<version>-linux-<arch>.AppImage` and `iblokz-ide-<version>-android-debug.apk`

---

## [1.5.1] - 2026-07-26

### Fixed

- CI: generate favicons (`prebuild:cap`) and install ImageMagick on runners
- Electron CI: disable electron-builder publish (`--publish never`; workflow attaches assets)

---

## [1.5.0] - 2026-07-26

### Added

- Linux AppImage packaging (`electron-builder`), production Electron load of `dist/`
- Native CI (AppImage + Android APK; macOS/iOS stubs); tag releases attach artifacts
- Dirty close confirm, drag-and-drop open, light Electron FS watch (`chokidar`)
- `./bin/deploy.sh --electron` installs AppImage + `.desktop` / icon / `~/.local/bin` launcher
- SemVer history, Keep a Changelog, and [docs/RELEASE.md](docs/RELEASE.md)

### Fixed

- Packaged AppImage: CJS-compatible `chokidar@3`, include `src/app/util/file-tree.js`
- Desktop favorites: `StartupWMClass=iblokz-ide` (matches Electron executable)

---

## [1.4.0] - 2026-07-26

### Added

- Capacitor 6 Android shell with Documents/`iblokz-ide` workspace FS
- `bin/start.sh --android` live-reload via LAN Parcel host
- Parcel HMR fix (`module.hot.accept` without webpack-style deps)

---

## [1.3.0] - 2026-07-26

### Added

- Electron desktop shell (frameless window, IPC FS, preload bridge)
- Shared `bin/` tooling (`start`, `build`, `deploy`, `init`, `assets`)
- Asset/icon pipeline (`bin/assets.sh`) and multi-size Electron / Android launcher icons
- Richer file/media browsing; lazy-loaded file tree

### Changed

- Header maximize on empty chrome (Electron); icon representations via `nativeImage`

---

## [1.2.0] - 2026-07-26

### Added

- GitHub Pages deploy workflow (`/ide/`)
- Editor + console vertical layout in the panes cycle
- AGPL-3.0 license; README refresh

### Fixed

- Web save/open for browsers without File System Access
- Codebin Enter/caret: EOF newlines, empty-line pads, backspace race

---

## [1.1.0] - 2026-07-25

### Added

- Web FS: folder open / read / save (File System Access + directory-input fallback)
- Resizable sidebar, editor, preview, and console panes; layout cycle; thin scrollbars

### Fixed

- Editor layout collapse when opening folders

---

## [1.0.0] - 2026-07-25

### Added

- App shell under `src/app/` (state, UI, services)
- Theme toggle, recent roots, save indicators

### Changed

- **Stack modernization:** Parcel 2, pnpm, RxJS 7, `iblokz-state` (breaking vs pre-1.0 Webpack/Browserify era)

---

## [0.3.0] - 2024-05-22

### Changed

- Switched bundler/tooling to Parcel and pnpm

---

## [0.2.0] - 2020-08-15

### Added

- Initial IDE UI and interaction
- Examples, code loading, basic AST parsing

---

## [0.1.0] - 2016-12-27

### Added

- Project setup and initial editor functionality (hot reload / UI boilerplate lineage)

---

[Unreleased]: https://github.com/iblokz/ide/compare/v1.13.0...HEAD
[1.13.0]: https://github.com/iblokz/ide/compare/v1.12.0...v1.13.0
[1.12.0]: https://github.com/iblokz/ide/compare/v1.11.0...v1.12.0
[1.11.0]: https://github.com/iblokz/ide/compare/v1.10.1...v1.11.0
[1.10.1]: https://github.com/iblokz/ide/compare/v1.10.0...v1.10.1
[1.10.0]: https://github.com/iblokz/ide/compare/v1.9.0...v1.10.0
[1.9.0]: https://github.com/iblokz/ide/compare/v1.8.2...v1.9.0
[1.8.2]: https://github.com/iblokz/ide/compare/v1.8.1...v1.8.2
[1.8.1]: https://github.com/iblokz/ide/compare/v1.8.0...v1.8.1
[1.8.0]: https://github.com/iblokz/ide/compare/v1.7.1...v1.8.0
[1.7.1]: https://github.com/iblokz/ide/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/iblokz/ide/compare/v1.6.1...v1.7.0
[1.6.1]: https://github.com/iblokz/ide/compare/v1.6.0...v1.6.1
[1.6.0]: https://github.com/iblokz/ide/compare/v1.5.1...v1.6.0
[1.5.1]: https://github.com/iblokz/ide/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/iblokz/ide/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/iblokz/ide/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/iblokz/ide/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/iblokz/ide/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/iblokz/ide/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/iblokz/ide/compare/v0.3.0...v1.0.0
[0.3.0]: https://github.com/iblokz/ide/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/iblokz/ide/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/iblokz/ide/releases/tag/v0.1.0
