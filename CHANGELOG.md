# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Start screen (open project, recent list, open demo) instead of booting straight into the demo editor

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

[Unreleased]: https://github.com/iblokz/ide/compare/v1.5.1...HEAD
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
