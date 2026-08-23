# Workspace layout rework (IDE)

**Date:** 2026-08-20  
**Updated:** 2026-08-23  
**Status:** Phase 1 done (ide-2 baseline); Phase 2 next  
**Scope:** `org/iblokz/ide` only  
**Baseline tree:** work in / continue from the `ide-2` checkout (same repo, parallel working copy)  
**Related:** [`org/iblokz/layout/planning/2026-08-20-01-layout-package.md`](../../layout/planning/2026-08-20-01-layout-package.md), [`org/iblokz/layout/planning/2026-08-20-02-layout-adoption.md`](../../layout/planning/2026-08-20-02-layout-adoption.md)

---

## Goal

Rework the IDE workspace into a clear semantic shell (left / center / right, with center hosting editor + preview and a bottom pane), replace the panes cycle with independent toggles, and keep structure/naming such that a later extract into a reusable layout package is natural — **without building that package in this plan**.

---

## Constraints

- **Defaults live in config and/or state initial values**, not in `util/`. Utils are for grouped utility functions (form, file, clamp helpers, etc.).
- Do **not** create or depend on `@iblokz/layout` here. Foresight only: semantic region names, thin pure helpers if needed, no app defaults buried in utils.
- **ESM for new / reworked modules** (jam-station style; Parcel supports mixing with existing CJS). Leave untouched legacy files as `require` until reworked.
- Prefer **compositional UI** (`fn.pipe`, `[].concat`) on new/reworked UI modules (see `.cursor/rules/compositional-ui.mdc` in ide-2).
- Toggles first; named layout **presets** are a later phase (and/or the package plan).
- Right pane and bottom terminal **content** can wait; Phase 2 must ship **layout chrome** for those regions.

---

## Current state (Phase 1 baseline — ide-2)

Shipped in the ide-2 working tree (changelog toward **1.9.0**):

| Area | Status |
|------|--------|
| Layout state | [`src/app/state/layout/index.js`](../src/app/state/layout/index.js) — `toggles` + `dim` |
| Layout menu | Header [`dropdown`](../src/app/ui/comp/dropdown.js) + SVG icons under `assets/static/icons/layout/` — Left / Right / Bottom / Preview (+ hotkey **labels**) |
| Left sidebar | Driven by `layout.toggles.leftSideBar` + `dim.leftSideBar` |
| Preview | `layout.toggles.preview` (codebin still maps toggles → legacy `panes-*` classes) |
| ESM | Header, UI index, layout state, dropdown reworked as ESM |
| Extra (same branch) | Theme registry pipeline, compositional-ui rule, gutter/scrollbar polish |

**Still legacy / incomplete after Phase 1:**

- Flat UI: `sideBar + gutter + header + codebin` — **no** semantic workspace shell (center / right / bottom chrome).
- Right / bottom toggles exist in the menu but do **not** show pane placeholders.
- Save + file title still in the **app header** (no editor header).
- Old `util/layout.js` (panes defaults / `cyclePanes` / localStorage helpers) is **removed**; layout toggles/`dim` still **not persisted** — restore via `config/layout` + `services/layout` in Phase 2.
- `previewConsole` in state but **not** in the layout menu; console still a sibling “panes mode”, not nested under preview.
- Dropdown is hover-first; mobile click / Escape / outside-close not fully aligned with the target UX.

---

## Target shell (semantic)

```
#ui
  header (app chrome)
  workspace (row)                 # when not start screen
    left-pane                     # files sidebar
    center (column)
      workspace-row (row)
        editor-area                 # empty | image | editor (+ editor header)
        preview-area                # iframe + console (console nested here)
      bottom-pane                   # placeholder (terminal later)
    right-pane                    # inactive / placeholder
```

- Console is part of the **preview area**, not a sibling of the editor.
- Editor area can later hold tabs or multi-row editors; through Phase 2 keep a single file.

---

## Layout state shape

**Chosen (Phase 1):** nested `toggles` + `dim` (keep this; do not flatten to ad-hoc top-level keys).

```js
layout: {
  toggles: {
    leftSideBar: true,
    rightSideBar: false,
    bottomPanel: false,
    preview: false,
    previewConsole: false   // meaningful when preview on + runnable type
  },
  dim: {
    leftSideBar: 260,       // px
    rightSideBar: 320,
    bottomPanel: 320,       // px height (or fraction — finalize in Phase 2)
    preview: 0.5,           // share of workspace row (editor ↔ preview)
    previewConsole: 240,    // console height within preview column
    editor: 0.5             // if still needed for editor-only sizing
  }
}
```

- Migrate old `panes` / flat layout keys on load so existing `localStorage` (`iblokz-ide.layout`) does not break.
- Drop `cyclePanes` / `PANE_MODES` / `nextPanes` / panes label-icon helpers once toggles drive geometry.
- Persistence: `services/layout` load/save/patch; defaults + clamp + migration in `config/layout` (or colocated with `state/layout` initial — **not** in `util/`).

### Where defaults go

| Concern | Place |
|---------|--------|
| Initial layout | `state/layout` initial (via `services/layout.load`) and/or `config/layout` defaults |
| Clamp ranges / migration from old `panes` | `config/layout` |
| Persistence (localStorage) | `services/layout` |
| Pure helpers (e.g. clamp number) | `util/` only if generic |

---

## Phases (this repo)

### Phase 1 — Toggles + layout menu — **done (ide-2)**

Independent visibility toggles and a header layout dropdown (icons + hotkey labels); left sidebar and preview driven by `layout.toggles` / `dim`. Single-file edit / run / preview still work. Does **not** yet include the full semantic shell, editor header, or util→config/service cleanup.

**Success (met):**

1. Layout visibility controlled by independent toggles, not a header cycle button.
2. `state/layout` holds `toggles` + `dim`; left sidebar + preview respond to toggles.
3. Layout menu via shared dropdown + layout SVG icons.
4. Single-file editing, save, and JS preview/console still work.
5. New/reworked modules use ESM (+ compositional UI where applied).

### Phase 2 — Shell + persistence + editor header

Finish the geometry and housekeeping that Phase 1 deferred:

1. **Workspace shell** (`ui/workspace.js` or equivalent): left | center | right; center = workspace-row (editor | preview) + bottom. Wire `rightSideBar` / `bottomPanel` toggles to real chrome (placeholders OK).
2. **Split codebin**: editor surface vs preview (iframe + **console nested**); gutters for editor↔preview, iframe↔console, center↔bottom when bottom on. Stop mapping to `panes-*` mode classes.
3. **Layout menu**: add Console (disabled when preview off); Right can stay “soon” if chrome exists but empty; `md+` hover, `sm`/`xs` click; Escape / outside to close.
4. **Editor header** (single file): title + Save (moved from app header). App header keeps brand, theme, window chrome, layout menu. Dirty / save-error / external-change can stay on the title for now or move with Save.
5. **Config + service**: add `config/layout` (defaults / clamp / migrate) and `services/layout` (persist `toggles`/`dim`); old `util/layout.js` panes helpers are already gone — do not resurrect them.
6. Styles for shell / panes / editor header; slim codebin styles as needed.

**Success:**

1. Workspace matches left | center(editor\|preview\[+console\]) | right + optional bottom.
2. Defaults/initial layout not defined in util modules; layout persists across reload.
3. Save lives in the editor header; app header no longer owns Save.
4. No panes cycle in state or UI.

### Phase 3 — Keyboard shortcuts

Wire the hotkeys already labeled in the menu:

- `Ctrl/Cmd+B` — left side bar  
- `Ctrl/Cmd+J` — bottom panel  
- `Ctrl/Cmd+P` (or `Ctrl/Cmd+Shift+V`) — preview — **pick one and match the menu label**  
- Optionally `Ctrl/Cmd+Shift+B` — right side bar  

### Phase 4 — Multi-file tabs (IDE-specific)

Tabs in editor header; one active buffer.

### Phase 5 — Multi-row editors (CodePen-style)

Stacked editors in editor area; each with its own header.

### Phase 6 — Presets (IDE UI)

Presets section in the layout dropdown **on top of** toggles (after toggles + shell are solid). May later align with the shared package’s preset API — see layout package plan.

### Phase 7 — Fill right + bottom

Real right-pane content and terminal — product features, not layout chrome.

---

## Out of scope (this plan)

- Creating `org/iblokz/layout` package or extracting shared code into a publishable package.
- Migrating dashboard / jam-station / media-browser / qoolejs.
- Building a recursive panel-tree engine (that belongs in the package plan).

---

## Changelog

Phase 1 work is documented under **1.9.0** in the ide-2 tree. Further phases: `[Unreleased]` (or the next version section) when implementing.
