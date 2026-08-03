# <img src="assets/icon.png" alt="logo" width="40" height="40" align="top"> iBlokz IDE

Browser / Electron / Capacitor code playground on the iBlokz stack.

**Live demo:** [iblokz.github.io/ide](https://iblokz.github.io/ide/)

Successor to earlier CodeMirror / PHP experiments, expanded from a slide-framework code sample block into a small IDE shell.

## Features

- Start screen: open a project, reopen recent folders (Electron), or try the in-memory demo
- Contenteditable editor with syntax highlighting (code-prettify) and live preview / console
- Open a local folder (desktop full FS via Electron; browser File System Access API or directory input; Android/iOS Documents workspace via Capacitor)
- File tree, open / save (when the backend is writable), recent project names
- Unsaved-change confirm on leave / window close; drag-and-drop to open files
- Resizable sidebar, editor, preview, and console panes
- Layout cycle: editor only → editor + preview → full (persisted in `localStorage`)
- Light / dark theme toggle

## Run / build matrix

| Target | Dev | Build | Deploy |
|--------|-----|-------|--------|
| Web | `pnpm start` | `pnpm build` | GitHub Pages (push to `main`/`master`) |
| Electron shell | `pnpm start:electron` | — | — |
| Linux AppImage | — | `./bin/build.sh --app-image` | `./bin/deploy.sh --app-image` (`~/.local`) |
| macOS DMG | `pnpm start:macos` | `./bin/build.sh --macos` | `./bin/deploy.sh --macos` (`~/Applications`) |
| Android | `./bin/start.sh --android` | `./bin/build.sh --android` | `./bin/deploy.sh --android` (adb) |
| iOS | `./bin/start.sh --ios` | `./bin/build.sh --ios` | `./bin/deploy.sh --ios` (Simulator) |

```bash
pnpm install
pnpm start                 # web — usually http://localhost:1234
pnpm start:electron        # Parcel + Electron shell
pnpm start:macos           # same shell on macOS
./bin/start.sh --android   # Parcel + Capacitor live-reload
./bin/start.sh --ios       # Parcel + Capacitor iOS live-reload
```

```bash
pnpm run build               # dist/ for GitHub Pages (public URL /ide/)
./bin/build.sh --app-image   # Linux AppImage → artifacts/electron/
./bin/build.sh --macos       # macOS DMG → artifacts/macos/ (Darwin; host arch)
./bin/build.sh --android     # Cap sync + debug APK → artifacts/android/
./bin/build.sh --ios         # Simulator .app.zip → artifacts/ios/
./bin/build.sh --all         # capable targets only (skips missing toolchains)
pnpm run check               # Biome
pnpm run lint                # Biome + ESLint
```

`--all` on init/build/deploy **skips** targets this host cannot build (e.g. no Android SDK → skip android with a message). Explicit flags still require the toolchain and exit non-zero if missing.

### Host / run targets

| Machine | Role | Notes |
|---------|------|--------|
| macOS 12 Monterey + Xcode 14.2 | Local build/dev | Electron **macOS 11+** DMG (host arch). Capacitor **5** iOS Simulator + Android (Cap 5 needs Xcode 14.1+). Prefer sequential native builds on 8 GB RAM. |
| GitHub Actions `macos-latest` | CI | Unsigned **universal** DMG (x64+arm64) + iOS Simulator zip |
| Older macOS (e.g. Yosemite 10.10) | — | **Not supported** for Electron 33 desktop (needs macOS 11+). Legacy builds deferred. Web/Pages only if a browser there is usable. |

### macOS prerequisites (MacPorts-first)

```bash
sudo port install ImageMagick
sudo port install ruby33 && sudo port select --set ruby ruby33
sudo gem install cocoapods           # iOS (needs Ruby 3.x — not Apple /usr/bin/ruby)
sudo port install openjdk21          # Android
sudo port install android-platform-tools
# + Xcode 14.1+ from the App Store (Capacitor 5); Android SDK / ANDROID_HOME for APK builds
```

Homebrew/apt equivalents are printed by the scripts when a tool is missing.

### Filesystem limits

| Platform | Workspace |
|----------|-----------|
| **Electron** | Full local filesystem via native dialogs / Node FS |
| **Web** | Folder the user grants (File System Access) or a one-shot directory input (read; write depends on API support) |
| **Android / iOS (Capacitor)** | App Documents directory under `iblokz-ide` — not arbitrary device paths |

## Stack

- [Parcel](https://parceljs.org/) — bundler
- [Snabbdom](https://github.com/snabbdom/snabbdom) + [iblokz-snabbdom-helpers](https://github.com/iblokz/snabbdom-helpers) — UI
- [iblokz-state](https://github.com/iblokz/state) + RxJS — state
- Electron — desktop shell; Linux AppImage + macOS DMG (unsigned in CI)
- Capacitor — Android APK + iOS Simulator wrap
- File System Access API / `<input webkitdirectory>` — local projects in the browser

## Remotes

- `origin` — `git@github.com:iblokz/ide.git`
- `gitlab` — `git@gitlab.com:iblokz/ide.git`

## Versioning

SemVer + [Keep a Changelog](CHANGELOG.md). Release order: **bump `package.json` → commit → tag `vX.Y.Z`** (see [docs/RELEASE.md](docs/RELEASE.md)). Artifact names come from `package.json`, so the tag must sit on the bump commit. Pushing a `v*` tag builds native artifacts for the GitHub Release.

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See [LICENSE](LICENSE) for details.
