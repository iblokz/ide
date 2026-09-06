# Yosemite / MacBookPro8,1 Electron DMG

**Date:** 2026-09-06  
**Status:** Phase 0 done (pin); deploy `--host` / `--macos-legacy` wired; Phase 1 packaging next  
**Target:** Mac OS X 10.10.5, MacBookPro8,1 (x64)  
**Remote:** `YOSEMITE_HOST` in `.env` (gitignored)

---

## Phase 0 result

| Version | Result |
|---------|--------|
| **11.5.0** | **OK** — `spike ready 11.5.0`, process running |
| 10 → 4 | not tried (11 worked) |

Pin: `artifacts/electron-spike/PINNED_VERSION` → **11.2.3**  
(Criterion: `loadFile(index.html)` → `did-finish-load`. **11.5.0** only passed a `data:` URL smoke and hangs on real `loadFile`.)


Spike tool: `./bin/spike-electron-yosemite.sh`  
LAN: `./bin/deploy.sh --macos-legacy --host`

---

## Remaining

1. `electron-builder.legacy-macos.yml` + `build.sh --macos-legacy` (x64, min 10.10, Electron 11.5.0)
2. Shell/preload: no `node:` imports; APIs OK on Electron 11 + 33
3. Renderer browserslist / smoke on device
4. README + optional CI
