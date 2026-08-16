# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### (none)

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

[Unreleased]: https://github.com/iblokz/ide/compare/v1.8.0...HEAD
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
