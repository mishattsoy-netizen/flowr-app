# Flowr Release, Build, and Push Guidelines

This document serves as the source of truth for any AI agent or developer performing code pushes, builds, or releases across Web (Vercel) and Desktop (Electron/GitHub Releases) platforms.

---

## 1. Release Flow Options

There are two primary ways to release updates: **Automatically via Push** (recommended) or **Locally via CLI**.

### Option A: Automatic Release on Push (CI/CD)
Whenever you push to the `main` branch, the deployment pipelines trigger in parallel:
- **Web App (Vercel)**: Automatically detects the commit and redeploys the live site.
- **Desktop App (GitHub Actions)**: Spins up a build runner, compiles the code, and publishes the installer directly to GitHub Releases.

#### Steps to Trigger:
1. **Verify or Bump Version**:
   Open `package.json` and update the version string (e.g., `"version": "1.0.0"` -> `"version": "1.0.1"` or `"1.5.1"` -> `"1.5.2"`).
2. **Commit and Push**:
   ```powershell
   git commit -am "chore: release v1.5.2"
   git push origin main
   ```

*Note: For the GitHub Actions workflow to run, the repository secrets `GH_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be configured in GitHub -> Settings -> Secrets and variables -> Actions.*

---

### Option B: Local Release Execution
If CI/CD is bypassed or a manual local publish is preferred:
1. Ensure your local environment has the GitHub Token loaded:
   ```powershell
   $env:GH_TOKEN="your_github_token"
   ```
2. Run the automated release script:
   ```powershell
   npm run release
   ```
   *To specify a custom version directly:*
   ```powershell
   npm run release 1.5.3
   ```
   This script automatically:
   - Bumps the version in `package.json`
   - Commits the version change to Git
   - Builds the Next.js frontend code
   - Compiles the desktop app and publishes it as **Latest** on GitHub Releases
   - Pushes to `main` branch (triggering Vercel)

---

## 2. Directory Clean-up & Artifact Rules
- **Build Output Directory**: The active build folder is **`dist-desktop-v3`** (defined in `package.json`).
- **Workspace Hygiene**: Always clean up redundant desktop build folders (e.g., `dist-desktop-v2`, `dist-desktop-v4` through `dist-desktop-v10`) and temporary patch files (`patch_*.js`, `check_db.js`, `test_*.html`) before compiling.
- **Run Clean-up Command**:
  ```powershell
  Remove-Item -Recurse -Force dist-desktop-v2, dist-desktop-v4, dist-desktop-v5, dist-desktop-v6, dist-desktop-v7, dist-desktop-v8, dist-desktop-v9, dist-desktop-v10 ; Remove-Item -Force check_db.js, patch_bot.js, patch_header.js, patch_header_right.js, patch_store.js, patch_store_final.js, patch_store_final_v2.js, patch_store_perfect.js, patch_ts.js, patch_v19.js, test_login.html, test_root.html, test_standalone.html
  ```

---

## 3. Important Config Rules
- **Package Files Array**: In `package.json`, the `"files"` pattern under `"build"` must include `"electron/**/*"`, `"package.json"`, `".next/standalone/**/*"`, and `".env"`. Do **NOT** exclude `node_modules` or else `electron-updater` will not bundle, causing the desktop app to crash on startup.
- **Direct Download Shortcut**: The download button on the client browser calls `/releases/latest/download/Flowr-Setup.exe`. Ensure the GitHub release is published as a **Standard/Latest Release** (not Draft or Pre-release) so this redirect path does not 404.
