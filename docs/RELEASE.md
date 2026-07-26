# Release process

App releases follow the same SemVer + Keep a Changelog habit as [iblokz-data](https://github.com/iblokz/data) and [world-metronome](https://github.com/alex-milanov/world-metronome): manual bumps, `vX.Y.Z` tags, no `standard-version` / semantic-release.

## Scheme

| Bump | When |
|------|------|
| **patch** | Bug fixes, docs, packaging polish |
| **minor** | New features (FS, Electron, Android, UI) backward compatible for users |
| **major** | Breaking product / stack changes |

Tags: `v1.4.0` (leading `v`). Changelog: [CHANGELOG.md](../CHANGELOG.md).

## Cut a release

1. On `master`, clean working tree (or only intentional release files).
2. Move `[Unreleased]` notes in `CHANGELOG.md` into a new `## [X.Y.Z] - YYYY-MM-DD` section; refresh compare links at the bottom.
3. Bump and tag:

```bash
pnpm version patch -m "chore: release v%s"
# or: minor | major
```

`pnpm version` updates `package.json`, creates a commit, and creates tag `vX.Y.Z`.

4. Push:

```bash
git push origin master
git push origin vX.Y.Z
```

Pushing a `v*` tag triggers [.github/workflows/native.yml](../.github/workflows/native.yml): build AppImage + APK and attach them to the GitHub Release.

Web/Pages deploy remains on push to `main`/`master` ([deploy.yml](../.github/workflows/deploy.yml)).

## Retroactive tags

Historical milestones were tagged on existing commits (see `git tag -l 'v*'`). Those tags document history; only `package.json` on `master` tracks the current version for AppImage/`electron-builder` artifact names.
