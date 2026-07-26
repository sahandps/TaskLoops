# Changelog

## 0.2.1

- **Fix: picking a context made the task disappear.** Setting a context forced
  the task into Next and marked it handled, so it vanished from whatever list
  you were looking at — out of the Inbox unclarified, or off the calendar if it
  was scheduled.
- Attributes no longer re-file a task at all. A context, date or person is
  orthogonal to the filing decision, so setting one leaves the task where it
  is. This applies to the date and waiting-on chips too, which had the same
  behaviour.
- Attributes now also survive a re-file, instead of being cleared whenever the
  bucket changed. Returning a task to the Inbox remains a full reset, since
  that means it is unclarified again.

## 0.2.0

Editing, faster attribute changes, and manual ordering.

- **Edit a task's text** from the panel: double-click it, or `⋯` → *Edit text*.
  Only the sentence changes — indentation, bullet, checkbox, blockquote or
  heading markers, the tag as written, any block id and the handled marker are
  all preserved, and the line is re-located by its previous text before
  writing. Renaming re-keys the record, so bucket, context, date and project
  links survive.
- **Context and waiting-on chips are clickable**, like the date chip already
  was. Empty ones appear on hover; on touch they are on the `⋯` menu.
- **Reorder by dragging** one task onto another within a list. The order lives
  in the plugin's data, so line order in your notes is untouched. Lists never
  reordered keep sorting by most recently filed.
- 33 new tests covering the line rewriting, which is the part that could damage
  a note.

## 0.1.2

- **Fix drag-and-drop.** Starting a drag rebuilt the tab rail one tick later to
  reveal the buckets that hide when empty, which destroyed the drop targets
  under the cursor and cancelled the drag. Those buckets are now always
  rendered and merely hidden, revealed by CSS while a drag is in flight, so no
  DOM changes during a drag.
- A background re-render — a note changing elsewhere, say — could also destroy
  the card being dragged. Renders arriving mid-drag are now deferred until the
  drag ends.
- Type `truncate` without an ES2019 method and raise the TypeScript `lib` to
  ES2022, which is what the runtime has actually been all along. The old `lib`
  left modern methods resolving as `any`.
- Type the dynamic imports in the test runner.
- `scripts/deploy.mjs` accepts `OBSIDIAN_CONFIG_DIR`, for vaults that do not
  use `.obsidian`.
- Lint the whole repository rather than `src/` alone; scoping it too narrowly
  is what let the untyped test runner reach a scorecard.
- README: install from the community directory, and drop the submission notes
  now that it is published.

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
