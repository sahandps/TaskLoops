# Changelog

## 0.1.1

Compliance and correctness pass against the community directory scorecard. No
behaviour changes.

- Raise `minAppVersion` to 1.7.2. `Workspace.revealLeaf` became asynchronous in
  1.7.2 and the plugin awaits it so the panel is fully loaded rather than
  deferred; declaring 1.4.0 was inaccurate.
- Await `revealLeaf` instead of leaving the promise floating.
- Replace the untyped reach into `app.setting` with a narrow declared interface.
- Style the reset button with Obsidian's own destructive class rather than the
  deprecated `setWarning()`, whose replacement would have required 1.13.0.
- Drop the `vault.process` fallback. It is available from 1.1.0, so the branch
  was never reachable.
- Remove the `builtin-modules` dependency in favour of Node's own
  `module.builtinModules`.
- Fix an unnecessary regex escape, several redundant type assertions, an unused
  import, and an async callback passed where a void return was expected.
- Add ESLint with `eslint-plugin-obsidianmd` and run it as part of `npm run
  build` and CI, so the directory's checks run before a release rather than
  after.

## 0.1.0

First release.

- Collects `#task` lines from anywhere in the vault into a right-sidebar inbox.
- GTD clarify flow: actionable, the two-minute rule, then next action, project,
  delegate or schedule.
- Projects tracked as outcomes, with stall detection when nothing is open
  against one. Actions attach by indentation, during clarify, or explicitly.
- Quick capture to a single nominated note, drag-and-drop filing, and dates.
- Marks each sorted line `*(Handled)*` and keeps all other state in the plugin's
  own data file, never in your notes.
