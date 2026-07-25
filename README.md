# iBlokz IDE

Browser (and eventually Electron / Android) code playground on the iBlokz stack.

**Live demo:** [iblokz.github.io/ide](https://iblokz.github.io/ide/)

Successor to earlier CodeMirror / PHP experiments, expanded from a slide-framework code sample block into a small IDE shell.

## Features

- Contenteditable editor with syntax highlighting (code-prettify) and live preview / console
- Open a local folder via File System Access API (Chromium) or directory input fallback
- File tree, open / save (when the backend is writable), recent project names
- Resizable sidebar, editor, preview, and console panes
- Layout cycle: editor only → editor + preview → full (persisted in `localStorage`)
- Light / dark theme toggle

## Development

```bash
pnpm install
pnpm start
```

Open the URL Parcel prints (usually `http://localhost:1234`).

```bash
pnpm run build   # production build to dist/ (public URL /ide/ for GitHub Pages)
pnpm run check   # Biome
pnpm run lint    # Biome + ESLint
```

## Stack

- [Parcel](https://parceljs.org/) — bundler
- [Snabbdom](https://github.com/snabbdom/snabbdom) + [iblokz-snabbdom-helpers](https://github.com/iblokz/snabbdom-helpers) — UI
- [iblokz-state](https://github.com/iblokz/state) + RxJS — state
- File System Access API / `<input webkitdirectory>` — local projects in the browser

## Remotes

- `origin` — `git@github.com:iblokz/ide.git`
- `gitlab` — `git@gitlab.com:iblokz/ide.git`

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**  See [LICENSE](LICENSE) for details.
