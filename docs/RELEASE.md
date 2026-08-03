# Release process

SemVer + [Keep a Changelog](../CHANGELOG.md), same habit as iblokz libs / world-metronome. No `standard-version` / semantic-release.

**Important:** Native artifact filenames use **`package.json` `version`**, not the git tag string. Always bump `package.json` **before** the release commit, then tag **that** commit. Tagging first (or tagging a commit that still has the old version) produces mismatched assets (e.g. tag `v1.6.0` shipping `iblokz-ide-1.5.1-*.AppImage`).

## Scheme

| Bump | When |
|------|------|
| **patch** | Bug fixes, docs, packaging polish |
| **minor** | New features (FS, Electron, Android, UI) |
| **major** | Breaking product / stack changes |

Tags: `vX.Y.Z` (leading `v`), matching `package.json`.

## Procedure

Do these **in order** on `master`:

### 1. Bump `package.json`

Set `"version"` to the release you are cutting (e.g. `1.6.1`).

Also update [CHANGELOG.md](../CHANGELOG.md):

- Move items under `[Unreleased]` into `## [X.Y.Z] - YYYY-MM-DD`
- Leave `[Unreleased]` empty (`### (none)`)
- Refresh compare links at the bottom (`[Unreleased]` → `vX.Y.Z...HEAD`, add `[X.Y.Z]` → previous tag)

### 2. Commit

Stage the release files (`package.json`, `CHANGELOG.md`, and the feature/fix work for this cut). Use a normal project commit message (same style as other commits), e.g.:

```text
add start screen with open project, recent, and demo; align artifact names
```

or for a fix-only cut:

```text
fix header title undefined and clear file on project switch
```

When an agent prepares the release, it should stage files and suggest the message; leave the commit to the developer unless they ask otherwise. Do **not** create the tag in this step.

### 3. Tag

Only after the bump is on the commit you just made:

```bash
# Confirm version on HEAD matches what you intend to ship
node -p "require('./package.json').version"
# → e.g. 1.6.1

git tag -a "v$(node -p "require('./package.json').version")" -m "v$(node -p "require('./package.json').version")"
```

Or explicitly:

```bash
git tag -a v1.6.1 -m "v1.6.1 — …"
```

### 4. Push commit + tag

```bash
git push origin master
git push origin "v$(node -p "require('./package.json').version")"
```

Pushing `v*` runs [.github/workflows/native.yml](../.github/workflows/native.yml): builds AppImage, Android APK, universal macOS DMG, and iOS Simulator zip, then attaches them to the GitHub Release.

Expected artifact names:

```text
iblokz-ide-<version>-linux-<arch>.AppImage
iblokz-ide-<version>-android-debug.apk
iblokz-ide-<version>-macos-<arch>.dmg
iblokz-ide-<version>-ios-simulator.app.zip
```

(`macos` arch may be `universal`, `x64`, or `arm64` depending on the build.)

Web/Pages deploy stays on push to `main`/`master` ([deploy.yml](../.github/workflows/deploy.yml)).

## Optional: `pnpm version`

If you prefer one command for bump + commit + tag:

```bash
# After CHANGELOG is edited for the new version:
pnpm version patch -m "fix … for v%s"
# or: minor | major

git push origin master --follow-tags
```

Still edit `CHANGELOG.md` **before** `pnpm version`, so the release commit includes both.

## Checklist

- [ ] `CHANGELOG.md` has a section for this version
- [ ] `package.json` version equals that section
- [ ] Feature/fix work is committed **with** that bump (or immediately before, same push)
- [ ] Annotated tag `vX.Y.Z` points at the bump commit
- [ ] `git push` of branch + tag
- [ ] GitHub Release assets show `iblokz-ide-X.Y.Z-…` (not an older version)

## Retroactive tags

Historical `v*` tags document older milestones. Only the version in `package.json` on the tagged commit controls artifact filenames for that release.
