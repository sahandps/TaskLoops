# Changelog

## 0.5.7 — 2026-10-20

- Use theme-accent Gantt bars and contrasting labels. Keep task names in a
  fixed column, synchronize vertical scrolling and allow editing from a row name.
- Add left-button dragging on empty Gantt grid space to pan both axes. Preserve
  bar movement, resize handles, toolbar controls and normal scrolling; clean up
  active drags on release, cancellation, window blur and view disposal.
- Add `[[` suggestions to task creation/editing, new subtasks and deferral reasons.
  Search existing Markdown notes, choose by mouse or keyboard and insert a
  source-aware wikilink using Obsidian’s link resolver. Preserve nearby text and
  existing closing brackets. Selection never submits the surrounding form.
- Keep all writes in the task source note; linking does not modify target note
  content, frontmatter or properties. Manually typed aliases/headings remain valid.

Validation: 748 checks across 26 suites, TypeScript, ESLint, formatting and
production build pass. Browser checks cover background panning, deadline resizing,
fixed task names, both keyboard and mouse note selection, Task/Subtask/Reason
fields and source Markdown persistence. Regression checks cover link replacement,
aliases/headings, target-note isolation, pan cancellation and vendor range rebasing.


## 0.5.6 — 2026-10-20

- Add Can’t schedule now to default Add/Edit task dialogs. Preserve draft wording,
  destination, existing and pending subtasks when saving a reason; cancelling
  returns to the unchanged draft. Reject deferral of completed tasks.
- Remove `!important`, `:has()` and the flagged `column-gap` declaration from
  generated and authored styles. Use scoped specificity, explicit view classes
  and `gap`; preserve sticky Gantt date labels without inline overrides.
- Disable EventCalendar’s unused remote-feed transport during production, preview
  and test bundling. Upstream transport changes now require build-time review.
- Attach only main.js, manifest.json and styles.css to releases. Retain GPL and
  vendor notices in the repository/bundle and corresponding source through
  GitHub’s automatic tag archives.
- Document expected vault enumeration and external scanner availability messages.

Validation: 719 checks across 24 suites, TypeScript, ESLint, formatting and
production build pass. Browser checks cover both dialog shortcuts, cancel/back
draft preservation, saving reasons with edited wording and pending subtasks, and
Gantt sticky date headers. CSS checks reject the reported patterns; bundle checks
verify disabled remote feeds and no outbound request API calls. The community
scanner must run again before its public report reflects this release.


## 0.5.5 — 2026-10-20

- Add Can’t schedule now with new/existing task selection and a required reason.
  Save the reason as an indented Markdown continuation, remove the current
  schedule, and keep the task in its source note.
- Offer Today, Tomorrow, Next week and custom dates beneath waiting tasks.
  Scheduling from any planner/editor path resolves the active reason in the
  same note write and records the action date and selected schedule date.
  Preserve earlier reasons when a task is deferred again.
- Fix Calendar text overflowing its event bar. Contain labels and checkboxes,
  ellipsize all-day titles, prioritise and ellipsize timed titles and scroll narrow weeks.
- Add ISO week numbers to planner headings, Month/Timeline and Year calendars.
  Cover ISO week-year boundaries, leap days and daylight saving transitions.
- Refresh manifest/package/README descriptions around the current calendar and
  note-based planner. Remove obsolete methodology wording from current docs.

- Add an Overdue filter with a search-aware task count beside All and
  Unscheduled. Switching filters cannot combine overdue and undated conditions.
- Show missed tasks independently of the visible calendar range, oldest final
  date first. Preserve the calendar's search results when changing list filters.
- Use the inclusive deadline when set, otherwise the due date. Today, future
  dates, completed tasks and undated tasks are not overdue.
- Mark overdue cards with a theme-aware border and days-overdue text.
  Completion and rescheduling refresh the list and count through normal writes.
- Add an Overdue filter to Notes and put overdue tasks first in matching notes,
  keeping them visible before the note's preview limit.

Validation: 697 automated checks, TypeScript, ESLint, formatting and production
build pass. Browser checks cover finding a task outside the calendar's current
week, deadline-based age, search counts, completion removal, empty states and
Notes filtering, new/existing deferral popups, schedule alternatives and the
resulting Markdown history. Date tests include inclusive deadlines, ISO weeks,
leap days and DST. Deferral tests cover stale writes, CRLF, quotes, numbered
lists, preserved children and atomic scheduling/history updates.

## 0.5.4 — 2026-10-20

- Redesign task creation and editing with a shared minimal dialog layout:
  restrained typography, more space, thin dividers and clear section headings.
- Separate Task, Note, Schedule and Subtasks. Show the selected note prominently
  with its path below; make navigation and note changes quiet secondary actions.
- Group due date and deadline together, with time and effort in a separate row.
  Shorten helper text and keep native date, time and numeric controls accessible.
- Keep the header and save/cancel actions visible while the form body scrolls.
  Adapt fields to narrow screens and inherit Obsidian's active theme colors.
- Preserve immediate completion, schedule validation, note selection, draft
  cancellation and subtask editing.

Validation: 613 automated checks, TypeScript, ESLint, formatting and production
build pass. Browser checks cover light/dark styling, fixed actions during
scrolling, creation with a deadline and duration, reopening saved values,
subtask drafts and cancellation. Native Obsidian theme verification remains
a smoke test.

## 0.5.3 — 2026-10-20

- Restore task completion checkboxes on Day, Week, Month and resource Timeline
  events. Clicking the checkbox does not drag the task or open its editor.
- Add a Mark complete checkbox to the task editor, including tasks opened from
  Gantt. Completion saves immediately while other draft edits stay open.
- Keep completed tasks checked and visible when Show completed is enabled.
  Saving further text or schedule edits preserves the completed Markdown checkbox.
- Return the actual completion result from the write service. Failed or stale
  writes restore the control for retry instead of showing false success. Share
  this behavior with sidebar and Notes task cards.

Validation: 613 automated checks, TypeScript, ESLint, formatting and production
build pass. Browser checks cover Calendar completion, completed visibility,
popup completion retaining draft text, saving edits without clearing completion,
and persistence after reload. Native Obsidian verification remains a smoke test.

## 0.5.2 — 2026-10-20

- Fix dragging an empty Calendar range only highlighting it without opening Add
  task. Connect the selection callback to the existing task creation dialog.
- Pre-fill due date, start time and exact duration for timed selections. For
  all-day and multi-day selections, pre-fill the inclusive deadline instead of
  inventing an effort duration. Preserve overnight and daylight-saving boundaries.
- Clear the selection highlight when opening the dialog. Selection creates only
  a draft; Cancel leaves notes unchanged and Add task performs the write.
- Preselect the source note when clicking or selecting within a resource Timeline
  row. Keep single-click task creation and its default duration working.

Validation: 598 automated checks, TypeScript, ESLint, formatting and production
build pass. Real browser drags verify a timed selection opening one pre-filled
Add task dialog and an October 6–8 selection producing the same inclusive date
span. Single-click creation is also verified without duplicate dialogs.

## 0.5.1 — 2026-10-20

- Fix Gantt label, header, control, row, grid and weekend colors in Obsidian dark
  themes. Map every vendor palette variable to Obsidian's active theme tokens.
- Fix Calendar background, event, selection, popup and text colors. Apply theme
  variables to the Calendar component itself so vendor defaults cannot hide them.
- Remove fixed green event colors; use the theme accent and its matching text
  color, with a separate theme-aware appearance for completed events.
- Scope vendor CSS and its default variables to the TaskLoops planner. Generic
  Gantt and Calendar selectors no longer apply to other plugins or the document root.
- Add Light, Dark and custom Plum palettes to the local preview. Theme changes
  apply immediately without rebuilding or reloading the view.

Validation: 584 automated checks, TypeScript, ESLint, formatting and production
build pass. Browser checks cover live palette changes in Calendar and Gantt,
readable dark labels/controls, theme-colored weekends, and no global Gantt variables.
Native Obsidian theme testing beyond the reported screenshot remains a smoke test.

## 0.5.0 — 2026-10-20

### Added

- Use EventCalendar for interactive Day, Week and Month calendars. Retain the
  Year overview and Notes grid.
- Add a resource Timeline with rows grouped by source note. Changing a timeline
  row does not move the task into another note; use the task editor for that.
- Add Frappe Gantt with draggable task bars, edge resizing and selectable time scales.
- Add a Deadline field to task creation and editing. A task spans from its due
  date through its inclusive deadline. Multi-day tasks stretch across Calendar's
  all-day row even when an optional time is present.
- Persist deadlines in the Markdown scheduling suffix. Moving a date span shifts
  both dates; resizing a deadline span updates its end while preserving effort.
  Reject invalid dates and deadlines earlier than the due date.
- Add a local browser preview with sample task storage, task editing, note
  previews and a reset control. It does not read or modify an Obsidian vault.

### Improved

- Separate pure task functions and models, application services, GUI components
  and Obsidian file operations into dedicated folders.
- Give views a shared task-actions interface; isolate Calendar and Gantt adapters,
  task cards, sidebar, dialogs, form fields and drag/drop controllers.
- Extract the task mutation queue and safe edit/move workflows into a service.
- Share stylesheet generation between plugin builds and the preview; add
  formatting commands, architecture documentation and dependency-boundary checks.
- Include MIT notices for EventCalendar and Frappe Gantt. Neither component needs
  a paid license. TaskLoops remains GPL-3.0-only.

### Compatibility and validation

- Preserve older date/time/duration schedules and existing settings. Tasks without
  deadlines retain their previous scheduling behavior. No automatic note migration.
- Keep the minimum Obsidian version at 1.7.2 and retain desktop/mobile metadata.
- 570 automated checks pass, including deadline round trips in all supported date
  formats, inclusive spans, DST boundaries, service writes, legacy schedules and
  architecture boundaries. TypeScript, ESLint, formatting and production build pass.
- Browser checks cover Calendar, Timeline, Gantt, Notes filtering, task editing
  and a timed deadline task displayed as a multi-day all-day bar. Native Obsidian
  mobile interaction still needs a device smoke test.

## 0.4.6 — 2026-10-16

- Make project selection explicit with a Choose project note button and a
  separate selected-note path in both task dialogs.
- Save new tasks into the chosen note. When no Tasks section exists, append
  `# Tasks` at the bottom of the note followed by the checkbox task.
- Reuse existing Tasks and legacy Tasks: headings without changing note
  properties or creating duplicate sections.
- Disable Open project note until the destination exists, and explain when
  the standalone note will be created.
- Update project-capture documentation, screenshot and release metadata.

Validation: 502 automated tests, TypeScript, ESLint and production build pass.
Browser checks cover selecting an existing project note and adding its task.

## 0.4.5 — 2026-10-16

- Default the Planner sidebar to unscheduled tasks. Scheduling a task removes
  it from that list; disabling Unscheduled only includes scheduled tasks again.
- Open TaskLoops in a main workspace tab on mobile, reuse existing main tabs,
  and replace restored sidebar instances after successfully opening the main
  view. A saved Week preference initially uses Day on mobile.
- Add calendar-plus buttons beside checkbox tasks in the note editor, including
  Live Preview, and Reading view. Open the task editor without inserting UI
  markers or properties into Markdown. Respect task-scan folder scope.
- Save pending editor changes before opening an inline task, verify source
  rows, and avoid guessing between moved duplicates. Exclude frontmatter and
  code examples, and clean up controls when views or the plugin unload.
- Update the README, inline-task screenshot, description and release metadata.

Validation: 496 automated tests, TypeScript, ESLint and production build pass.
Browser checks verify note buttons, correct task selection and removal from the
sidebar after scheduling. Mobile tab routing is tested with workspace doubles;
native Obsidian mobile touch behavior still needs a device smoke test.

## 0.4.4 — 2026-10-16

- Resize the task list and calendar using a remembered divider: horizontal
  adjustment on desktop and vertical adjustment in stacked layouts. Support
  pointer/touch dragging, arrow keys, Shift for larger steps, Home/End limits,
  double-click reset and Escape to cancel a drag.
- Add Jump to task in note and Open project note buttons to the task editor.
  Both open new tabs; the project link follows the selected destination. The
  Add task dialog also includes the project-note link. Unsaved dialog edits stay
  intact, and navigation never creates missing destination notes.
- Separate new schedule details from task wording with ` - Due date:`.
  Recognize manually typed `date:` suffixes, including ` - date: 2026-10-19`.
  Continue reading older schedule suffixes. Ordinary bullet lists remain excluded.
- Update the README, task-editor screenshot, plugin description and metadata.

Validation: 479 tests pass; TypeScript, ESLint and production build pass. Browser
checks cover desktop divider dragging, keyboard resizing, stacked orientation
and editor navigation controls. License remains GPL-3.0-only.

## 0.4.3 — 2026-10-16

- Replace the custom license with the unmodified GNU General Public License,
  version 3 only (`GPL-3.0-only`). Update package metadata, README, build banner
  and copyright notice. Historical releases keep their original licenses.
- Attach the corresponding source archive, license and notice to the release
  alongside the compiled plugin files.
- No planner or task-data behavior changes from 0.4.2.

## 0.4.2 — 2026-10-16

- Add a Notes task grid alongside the calendar Planner, with note/task search,
  folder and task-status filters, expandable previews and per-note task creation.
- Open source notes in new tabs from note headings and calendar source links.
- Improve narrow-screen layouts, touch controls and community-theme styling.
- Keep short timeline events compact and remove their internal scrollbars.
- Remove the redundant Open full view button; retain the command-palette action.
- Make settings searchable on Obsidian 1.13+ while retaining the settings page
  on Obsidian 1.7.2+.
- Offer 15 date formats, 12/24-hour display, Monday/Sunday/Saturday week starts,
  opening-hour and calendar-scale preferences, default task durations, completed
  visibility defaults and compact/comfortable note cards.
- Add a task scan folder to limit note-content reads. File-path enumeration
  remains part of task discovery and project-note search.
- Refresh the README, Notes-grid screenshot and plugin description.
- License change: 0.4.2 uses the TaskLoops Free-to-Use Proprietary License.
  Personal and commercial use of unmodified copies is free. Modification and
  redistribution require permission, subject to the license's exceptions.
  Earlier MIT releases retain their MIT rights. Future versions may use
  different terms or pricing. User notes and task data are unaffected.

Validation: 452 automated tests pass; TypeScript, ESLint and production build pass.
Mobile layouts were checked at phone width in the browser preview; native
Obsidian mobile touch behavior still requires an in-app smoke test.


## 0.4.1 — 2026-10-16

- Choose existing tasks as subtasks from a searchable note and task picker.
  Selections remain drafts until Save; guard multi-note moves and recover source
  notes before the destination if saving fails. Click an existing subtask row
  to open its own task editor.

- Replace GTD buckets, clarification and the board with a calendar planner and
  a sidebar grouped alphabetically by source note.
- Plan in Day, Week, Month and Year. Timed events show duration, overlap lanes
  and overnight continuations; Year marks dates containing tasks with dots.
- Drag tasks to five-minute start times with a live time marker. Resize timed
  events with a lower-edge handle or keyboard controls.
- Click a task to edit wording, schedule, project note and new subtasks together.
  Project selection uses Obsidian's native fuzzy note search.
- Store explicit `Due date:`, `Time:` and `Duration:` suffixes in Markdown, with
  four supported date formats and recognition of bare ISO date suffixes.
- Add new project tasks under `Tasks:` in the selected note. Standalone tasks
  default to `Standalone Tasks.md`; subtasks are indented checkboxes.
- Move a task and its subtree between project notes with checks for stale edits
  and safe rollback on failure. Preserve note properties and unrelated content.
- Keep legacy plugin data and saved dates available without automatic note edits.
- Add tests for scheduling, resizing, task editing, subtasks, project moves and
  rollback safety. Update the README and plugin metadata for the calendar planner,
  including screenshots captured from the browser preview with sample notes.

## 0.4.0

- Discover ordinary Markdown checkboxes across the vault automatically. Settings
  can switch between checkboxes, a custom tag, or both.
- Stop writing handled markers and remove sidebar text editing. Existing task
  lines are now changed only when `[ ]` becomes `[x]` on completion.
- Capture creates native `- [ ]` tasks, and projects can be created directly
  from the header or command palette.
- Group Inbox tasks by source note, add clearer drag handles and drop feedback,
  and keep drag alternatives available from task menus.
- Improve the month calendar with an explicit Today button and a full selected
  day panel directly under the grid.

## 0.3.1

- **Fix: the calendar barely showed anything.** Dated tasks were reduced to 4px
  dots on 39px cells, and the day it opened on was today, which is usually
  empty — so it read as an empty grid even with tasks dated all around it.
- **Day, week and month scales.** Day shows one day in full; week shows seven
  day panels, stacked in a sidebar and fanned into columns when there is room;
  month shows a grid of count badges, tinted by the highest priority on each
  day, followed by every dated day of the month with its tasks listed out.
- Every day is a drop target at every scale, so rescheduling is a drag.
- Each day has a **+** that creates a task already dated to it.
- Undated tasks are listed at the bottom, so there is always something to drag
  onto the calendar.

## 0.3.0

Three layouts, priority, and drag-and-drop everywhere.

- **The nine bucket tabs collapse into one GTD button.** It names the list on
  screen and opens a picker with counts for the rest.
- **Board layout**: a Kanban column per bucket, cards dragged between them.
  Columns fill the panel height so the space under the last card is a target
  too. Columns scroll horizontally in a sidebar; *Open in a main tab* from the
  palette gives the board full width, over the same data.
- **Calendar layout**: a month grid of everything dated, with priority-tinted
  dots, overdue days marked, and the selected day's tasks plus an undated list
  underneath. Dropping a task on a day sets that date.
- **Priority**: P1/P2/P3 or none, from the chip or the menu. P1 and P2 colour
  the card's left edge. It sorts after any manual order and before recency, so
  nothing reshuffles until you use it.
- **A drop rail** appears along the bottom while dragging, carrying every
  bucket as a target. That is what lets the tab rail collapse to one button
  without losing drag-to-file.
- The board and calendar are built on one shared surface, so cards, dragging,
  sorting and filing behave identically in all three layouts rather than being
  reimplemented per view.

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
