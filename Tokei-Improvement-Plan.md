# Tokei – Assessment and Improvement Plan

This document summarizes the current state of the Tokei plugin and proposes a prioritized roadmap to modernize it, adopt Obsidian’s latest APIs, improve reliability, and streamline the codebase.

## Current State Summary
- View: Custom `ItemView` named `tokei` renders time/date, fiscal week/quarter, and timezone blocks. See [main.ts](main.ts).
- Settings: `PluginSettingTab` provides configurable formats and options, stored via `loadData`/`saveData`.
- Time: Uses Luxon for formatting; manual UTC offset handling for “timezones”.
- Build: Esbuild bundling to `main.js`, TypeScript 4.7, target ES6/ES2018, `obsidian` typings set to `latest`.
- Dependencies: `luxon` in use; `moment` and `lucide` present but unused.

## Findings and Issues
- Duplicate update intervals:
  - `ClockView.onOpen()` sets an interval at [main.ts#L47](main.ts#L47).
  - `ClockPlugin.initView()` sets another interval at [main.ts#L347](main.ts#L347).
  - These can stack and leak; prefer a single view-scoped interval with API-managed cleanup.
- Global `plugin.view` reference: Storing a single view instance can break if multiple leaves exist. Prefer querying via `getLeavesOfType()` as needed.
- Manual timezone offsets: Using numbers like `-5` is error-prone (DST, fractional offsets, locale). Prefer IANA zones via Luxon (`DateTime.now().setZone('America/New_York')`).
- Unused dependencies: `moment` and `lucide` appear unused and can be removed.
- Build/tooling: TypeScript target is dated; `obsidian` typings aren’t pinned; production build not minified; esbuild target could be modernized.

## API Modernization (Obsidian)
- Use `Component.registerInterval()` for cleanup instead of manual stored handles in the view. Replace `window.setInterval` in `ClockView` with `this.registerInterval(...)` and remove plugin-level interval.
- Use `this.addRibbonIcon('clock', 'Tokei: Open', ...)` to add an optional ribbon entry to open the view.
- Consider `this.addStatusBarItem()` to offer a minimal clock in the status bar (toggle in settings).
- Query views with `app.workspace.getLeavesOfType(ClockViewType)` rather than holding a single `view` reference. Avoid assumptions of a single leaf.
- Keep `onLayoutReady` for auto-activation, but avoid spawning multiple views; respect existing leaves.

## UX/Functionality Improvements
- Timezones:
  - Migrate from numeric offsets to IANA timezones; offer a searchable dropdown populated from `Intl.supportedValuesOf('timeZone')` (with fallback list).
  - Display city/zone names and handle DST automatically via Luxon `setZone()`.
- Settings UX:
  - Add validation and inline feedback for formats using try/catch around Luxon formatting.
  - Add presets for common formats (12/24h, ISO dates).
  - Provide toggles for: show status bar clock, open in right/left sidebar, auto-focus pane.
  - Align timezone-related blocks under "Show timezones": place Label style as its own block between Timezone Format and the timezone grid; hide all together when toggled off.
  - Widen Offset/IANA field and keep Name shorter; support suggestions via datalist of IANA zones.
- Performance:
  - Reduce DOM churn by only updating changed nodes (already partially done) and batch updates for timezone list.
- Accessibility:
  - Ensure headings and buttons have accessible labels; improve contrast with CSS variables.

## Code Quality and Structure
- Refactor `ClockView` to isolate render/build vs update logic.
- Remove unused `settingsChanged` and `checkAndSortTimezones()` or wire them properly; if sorting is desired, do it deterministically on `saveSettings()`.
- Extract settings schema/types to a dedicated module for clarity.
- Add lightweight unit tests for date/quarter/week calculations (pure functions).

## Build and Tooling
- Pin `obsidian` API typings (e.g., `^1.x`) and align `minAppVersion` appropriately.
- Upgrade TypeScript to `^5.x`, set `target` to `ES2020` or `ES2022`, and modernize `lib` entries.
- Esbuild: add `minify: true` in production, set `target: 'es2020'`, and enable `sourcemap: false` for prod.
- Remove `moment` and `lucide` from `dependencies` to minimize footprint.

## Documentation
- Update README to describe status bar option, ribbon icon, and IANA timezone migration.
- Document settings layout: Timezone Format, Label style (blank names), and Timezone grid grouped under the Show timezones toggle.
- Add a brief migration note for existing users (map old offsets to nearest zones when possible).

## Backward Compatibility
- Provide a conversion step on `onload()` that transforms existing `timeZonePairs` offsets to zones (best-effort mapping or prompt).
- Maintain the old numeric offset field temporarily with deprecation message in settings until users migrate.

## Roadmap (Prioritized)
1) Fix duplicate interval and adopt `registerInterval`
- Remove plugin-level interval at [main.ts#L347](main.ts#L347).
- Use `this.registerInterval(...)` inside `ClockView.onOpen()`.

2) Decouple single `view` reference
- Stop storing `plugin.view`; query via `getLeavesOfType(ClockViewType)`.

3) Timezone migration to IANA
- Update settings UI to use dropdown + search; store zone IDs.
- Compute timezone times via `DateTime.now().setZone(zone).toFormat(...)`.

4) API/UI enhancements
- Optional ribbon icon and status bar clock.
- Respect existing leaves on activation; avoid opening duplicates.
 - Group and align settings under Show timezones; ensure immediate refresh when labels or offsets change.

5) Build/tooling updates
- Pin `obsidian` typings; bump TypeScript; modernize tsconfig and esbuild (minify, target).
- Remove unused `moment`/`lucide`.

6) Tests and docs
- Unit tests for week/quarter/year helpers.
- README migration notes and updated screenshots.

## Acceptance Criteria
- Single, leak-free update loop managed by Obsidian’s interval registration.
- IANA timezone support with DST correctness and improved UX.
- No unused dependencies; reproducible builds with pinned APIs.
- Clear settings and documentation; optional status bar clock works.
