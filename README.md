# TaskLoops

[![Obsidian plugin](https://img.shields.io/badge/Obsidian-TaskLoops-7c3aed?logo=obsidian&logoColor=white)](https://obsidian.md/plugins?id=taskloops)
[![License: GPLv3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

Turn the Markdown checkboxes in your Obsidian vault into a calendar you can plan
with. TaskLoops gathers tasks from your notes, groups them by note name, and
lets you schedule, resize and edit them without managing note properties.

- Plan in **Day, Week, Month and Year** views, plus a resource **Timeline** and **Gantt**.
- Set a **Deadline** to stretch a task from its due date through its last day.
  Multi-day tasks appear in Calendar’s all-day row, even when they have a time.
- Switch to **Notes**, a searchable task grid grouped by source note.
- Drag tasks to a date or time in **five-minute intervals** and resize durations.
- Click a task to edit its wording, schedule, project note and subtasks.
- Pick projects with **Obsidian's native fuzzy note search**.
- Open a source note in a **new tab** using the arrow beside its sidebar heading
  or its name on a calendar task. The note opens at the task's line.
- Keep standalone tasks in one configurable note and project tasks under a `Tasks` heading.

**Current release: 0.5.0 — calendars, Gantt and deadlines.** See the [changelog](CHANGELOG.md) for details. Install or update TaskLoops from
Obsidian's Community plugins, or download the plugin files from
[Releases](https://github.com/sahandps/TaskLoops/releases).

## What’s new in 0.5.0

- **Calendar:** EventCalendar powers Day, Week and Month, with drag/drop,
  resizing, overlapping events and five-minute scheduling.
- **Resource Timeline:** see tasks in time-based rows grouped by source note.
- **Gantt:** plan task spans, move bars, resize their edges and edit tasks.
- **Deadlines:** the due date is the first day; the deadline is the inclusive
  last day. Date spans are separate from effort duration and remain ordinary Markdown.
- **Cleaner code:** separate core functions, application services, GUI components
  and Obsidian file access. See the [architecture guide](docs/architecture.md).
- **Local preview:** inspect the real GUI with browser-local sample tasks using
  `npm run preview`. Both UI libraries are MIT licensed; no paid UI license is needed.

Existing tasks, settings, the Year overview and Notes grid remain supported.
Notes are not automatically rewritten on upgrade. To update an installed copy,
open **Settings → Community plugins → Check for updates**, then update TaskLoops.

## Screenshots

The deadline screenshot shows the 0.5.0 browser preview with sample tasks.
Other screenshots show the earlier interface; calendar controls and task dialogs
have changed in 0.5.0. Obsidian supplies its theme, native note picker and vault access.

### Multi-day deadlines

This task runs from October 20 through October 23. Its optional time and effort
remain available in the editor while its date span sits above the hourly grid.

![Deadline task stretching across Calendar’s all-day row](docs/images/deadline-span.png)

### Browse your task notes

Switch to **Notes** for a searchable grid of task cards grouped by source note.
Filter by folder or task status, edit tasks, and add new tasks to a project note.

![Notes task grid with folder and task-status filters](docs/images/notes-grid.jpg)

### Plan your day

Tasks stay grouped by source note while the calendar shows their start times,
durations and overlaps. Drag to schedule and use the bottom handle to resize.

![Day planner with note-grouped tasks, overlapping events and resize handles](docs/images/day-planner.jpg)

### Edit a task and its subtasks

Open a task to change its text or schedule, pick a project note, and add subtasks.
**Jump to task in note** opens the source at the task's line in a new tab.
**Open project note** opens the currently selected destination in a new tab.
Navigation does not save or discard the dialog's unsaved edits. New destinations
must be saved before they can be opened. The Add task dialog also has the
project-note link.

![Task editor with project selection, date, time, duration and subtasks](docs/images/task-editor.jpg)

### Search your project notes

Use **Choose project note…** to search existing notes. The selected note path is
shown separately; **Add task** writes into that note. When it has no Tasks
section, TaskLoops appends the following at the end of the existing content:

```markdown
# Tasks
- [ ] Your new task
```

Existing Tasks headings (including older `## Tasks:` sections) are reused without
duplicating them. Choosing a note alone does not modify it.

![Task creation with an explicitly selected project note](docs/images/project-destination.jpg)

Type a note name or folder path to find the destination for a task. In Obsidian,
this uses the native fuzzy note picker; the browser preview demonstrates the flow.

![Searching project notes for the Website note](docs/images/project-search.jpg)

### See tasks across the year

Dots mark dates containing tasks. Select a date to open its daily timeline.

![Year calendar showing task dots beneath October dates](docs/images/year-calendar.jpg)

## The planner

The task sidebar and calendar appear together. In a main tab they sit side by
side; in a narrow Obsidian sidebar the task list sits above the calendar. Use
the command palette's **Open planner in a main tab** command for more room.
Drag the divider between the task list and calendar to resize them. At narrow
widths, drag it vertically instead. Panel sizes are remembered independently
for desktop and stacked layouts. Focus the divider and use arrow keys (Shift
for larger steps), Home/End for its limits, or double-click to reset.

- **Day:** a 24-hour timeline with five-minute drag-and-drop scheduling.
- **Week:** seven daily timelines, with simultaneous tasks shown alongside each other.
- **Month:** tasks inside day cells, with multi-day tasks spanning dates.
- **Year:** twelve mini calendars with dots beneath dates containing tasks.
  Up to three dots are shown per date; its accessible label gives the full task
  count. Click a month heading to open that month, or a day to open its timeline.

- **Timeline:** resource rows grouped by source note, with a horizontal time axis.
- **Gantt:** task bars with date-span resizing, navigation and selectable time scales.

Arrows navigate by the selected scale. **Today** returns to the current day.
Weeks begin on Monday by default; settings also offer Sunday and Saturday. Dates and times are local wall-clock values.

## Tasks grouped by note

All Markdown checkbox tasks are discovered automatically, using Obsidian's
metadata cache so frontmatter and fenced code examples do not become tasks.
The sidebar groups them by note name, alphabetically, and preserves source-line
order within each note. Full paths distinguish notes with the same name.

Search by task text or note path. **Unscheduled only** is enabled by default: adding a due date removes a task
from the sidebar while keeping it on the calendar. Clear the filter to include
scheduled tasks in the sidebar again. **Show completed** includes completed
tasks in both places. Completed tasks are hidden by default.

Click a note heading or a calendar card's note name to open the source. Click a
task title or the card itself to open its editor. You can also edit task wording
directly in the source note.

## Notes view

Switch between **Planner** and **Notes** at the top of TaskLoops. Notes shows a
responsive grid of notes containing Markdown tasks, sorted by note name. Search
note paths or task text, choose a folder, and filter by open tasks, tasks due
today, or undated tasks. Filters select matching notes; their other tasks remain
visible for context. **All task notes** also includes notes with only completed
tasks. Notes without Markdown tasks are not included.

Click a task to edit it, or **+ Task** on a note card to add to that note's
`Tasks:` section. The arrow or note title opens the source in a new tab. Cards
preview a configurable number of tasks; **Show all** expands longer lists.

On narrow screens the grid becomes one column and the Planner task list stacks
above the calendar. Week and month calendars scroll horizontally to keep dates
readable. On mobile, tap a task to schedule it through the editor. Short timed
events show a compact title; click or tap to see scheduling details and edit the task.
Use the task editor when a narrow screen makes dragging difficult.

## Settings and vault access

Settings include the default view for new panels, tasks per note card (3, 5 or
10), comfortable/compact note cards, calendar scale for new panels, completed-task
visibility for new Planner panels, and the following scheduling preferences:

| Setting | Choices |
| --- | --- |
| Date format | 15 formats with examples (listed below) |
| Time display | 24-hour or 12-hour with AM/PM |
| Week starts on | Monday, Sunday or Saturday |
| Timeline opening hour | Any hour from 00:00 to 23:00; the whole day stays available |
| Default task duration | 5, 15, 30, 45, 60, 90 or 120 minutes for new timed schedules |

The standalone note destination and optional **Task scan folder** are also
configurable. A scan folder includes its subfolders and limits task-content reads;
leave it blank for all Markdown notes. Tasks outside the scope remain untouched
in their source notes. Existing settings and legacy data survive upgrades.

The settings use Obsidian's searchable definitions on 1.13+ and keep the settings
page available on 1.7.2+. Both versions use the same setting definitions and
save through TaskLoops' existing data wrapper.

TaskLoops processes notes locally and does not upload their contents. The vault
enumeration disclosure is expected: discovery and native project search list
Markdown file paths. A folder scope limits content reads, not permission to list
paths. It does not sandbox the plugin. **Malware scan not available** is a status
from the external review service; implementing settings search does not provide
or certify a malware scan.

## Schedule from a note

A small calendar-plus button appears after checkbox tasks in the note editor
(including Live Preview) and Reading view. Click or tap it to open the existing
task editor for dates, time, duration, projects and subtasks. The button is a
visual control: it is never written into your Markdown or note properties.
The editor saves pending note edits before opening the task, and verifies the
source row again before offering edits. Code examples and frontmatter are
excluded. In Reading view, custom renderers or embeds without a reliable task
mapping may omit the button rather than point it at a different task.

![Task scheduling buttons in a sample note and editor](docs/images/inline-task-button.jpg)

On mobile, TaskLoops opens in a main workspace tab instead of the right sidebar.
An existing mobile sidebar instance is moved to the main area when restored or
opened. A week-based planner initially opens in Day view on mobile; Week remains
available from the calendar scale controls. Desktop opening keeps its existing
sidebar/main-tab options.

## Dates, times and durations

Click a task, its schedule details or **⋯** to open the task editor and set its
optional due date, start time, and duration in whole hours and minutes. For example:

```markdown
- [ ] Buy groceries - Due date: 2026-10-16 Time: 14:00 Duration: 1 Hour 5 Minutes
```

Date-only tasks are supported:

```markdown
- [ ] Renew insurance - Due date: 2026-10-16
```

The originally supported bare ISO date also works:

```markdown
- [ ] Buy groceries 2026-10-16
```

New schedules use ` - ` between the task wording and its details. You can also
type `- [ ] Task - date: 2026-10-19` manually; it is discovered on the calendar
without opening the task editor. `date:` and `Due date:` are case-insensitive.
Only Markdown checkbox tasks are gathered; ordinary `- Text` bullets are not.
Undated checkbox tasks stay in the sidebar. Older schedules without the separator
remain readable and are converted only when you explicitly edit their schedule.

Scheduling fields must be at the end of a task, before an optional Obsidian block
id. A time or duration requires a date. A task with no time appears in the
all-day row. Timed tasks occupy their duration; a task with no duration uses a
30-minute fallback block. Newly scheduled timed tasks use the default duration
chosen in settings, saved explicitly to the task. Events extending past midnight continue on the following day.

**Settings → TaskLoops → Date format** offers 15 choices:

- Year first: `YYYY-MM-DD` (default), `YYYY/MM/DD`, `YYYY.MM.DD`, `YYYYMMDD`.
- Day first: `DD/MM/YYYY`, `DD.MM.YYYY`, `DD-MM-YYYY`, `D/M/YYYY`, `D.M.YYYY`, `D-M-YYYY`.
- English month names: `D MMM YYYY`, `DD MMM YYYY`, `D MMMM YYYY`, `MMM D, YYYY`, `MMMM D, YYYY`.

Each option shows an example in settings. The choice applies to task dates in
the interface and future scheduling writes. All supported formats remain
readable after changing settings; existing notes are never bulk-rewritten.
Numeric day-first dates always keep their meaning: `03/04/2026` is April 3.
Use English month names for month-first dates without ambiguity. Invalid dates
remain untouched as part of the task wording. Time display can use AM/PM while
Markdown always stores `HH:mm` so notes stay portable.

## Drag to plan

- Drag a sidebar task onto a day to assign that date.
- Drop anywhere on a Day or Week timeline to set its start time in five-minute
  intervals. A marker shows the exact time while dragging.
- Drag a calendar task to another day or time to reschedule it. Duration is preserved.
- Drop on the all-day row to clear the start time while keeping the date and duration.
- Drop on **Drop here to remove a schedule** in the sidebar to clear date, time and duration.

Day cells in Month and Year preserve an existing start time. Every scheduling
action is also available through the task editor for keyboard and touch use.

## Resize a task or date span

In Day and Week, resize the bottom edge of a timed event to change its duration.
In Gantt, resize a bar's edges. For tasks with a deadline, resizing the date span
updates the deadline while keeping effort duration separate. Moving a deadline
span shifts both dates together. Multi-day spans stay in the all-day row above
the hourly grid. The task editor also accepts exact time and duration values.

Completed tasks cannot be rescheduled. To edit dates using a keyboard or on
mobile, open the task editor and select **Save changes**.

## Edit tasks and add subtasks

Click a task title, its card, schedule details or **⋯** to open **Edit task**.
The popup lets you change its wording, choose its project note, edit its
schedule, and add subtasks. Changes are applied only when you select
**Save changes**; **Cancel** discards the draft. **Remove schedule** clears the
form's scheduling fields and is applied when you save.

Existing direct subtasks are clickable rows in the popup: select one to open
its own editor, then return to the parent. Add new ones with the subtask field
and **Add subtask** or Enter. An unfinished entry is also included when
you save. New subtasks are ordinary indented Markdown checkboxes beneath their
parent, so they work in the source note and appear indented in the sidebar.
Each subtask has its own completion and optional schedule; completing a parent
does not complete its subtasks.

### Choose an existing task as a subtask

Use **Choose existing task…** in the parent's popup to browse tasks already in
your notes:

1. Search for a note that contains available open tasks.
2. Search its task list; each result shows its current schedule and source line.
3. Select one or more tasks. The pending rows show where they come from and can
   be removed before saving.
4. Select **Save changes** to move them beneath the parent. Their schedules,
   formatting and own subtasks are preserved; successful saves keep one copy.

Selecting a task makes no note changes until you save. Cancel discards the
selection. Existing descendants, ancestors and overlapping selections are
excluded to prevent loops. Open an added subtask's popup by clicking its row.

![Searchable existing tasks with their schedules in the selected note](docs/images/existing-subtask-picker.jpg)

Choosing another **Project / note** moves the task and its indented subtree to
that note's `Tasks:` section. Formatting, block ids and existing subtask content
are preserved; unrelated sections and note properties stay in place. Moving a
task into a different note updates its sidebar group automatically.

## Projects are notes

Use **+ Task**, a note group's **+**, a calendar day's **+**, or an empty timeline
slot to create a task. The task form lets you **pick a project / note** from all
Markdown notes in the vault. The picker uses Obsidian’s native fuzzy search:
type part of a note name or folder path, use the arrow keys to navigate, and
press Enter to select. Escape cancels. No project properties or special project
tasks are required.

New tasks go under a `Tasks:` heading in the note you pick:

```markdown
## Tasks:
- [ ] Review homepage - Due date: 2026-10-16 Time: 10:00 Duration: 1 Hour 30 Minutes
```

An existing heading is reused; otherwise `## Tasks:` is appended at the end.
Insertion stops before the next heading of the same or higher level. Headings
inside code fences and frontmatter are ignored. Existing tasks elsewhere in the
note stay where they are.

Choose **Standalone tasks** for tasks without a project. These go in
`Standalone Tasks.md`, created on first use. Its path is configurable in
settings. Changing that path changes the destination for future tasks; it does
not move earlier tasks.

## What changes in your notes

TaskLoops makes these deliberate edits:

1. Completing a task changes its checkbox from `[ ]` to `[x]`. Reopen it in the source note.
2. Scheduling adds, updates or clears the scheduling suffix on that task line.
3. Adding a task inserts a new checkbox under `Tasks:` in the selected note,
   creating that heading or the standalone note when needed.
4. Saving edited wording changes that task's text while preserving its checkbox,
   Markdown list prefix and block id. New subtasks are added as indented checkboxes.
5. Choosing another project in the editor moves that task's subtree into the
   destination note's `Tasks:` section.

Frontmatter, note properties and unrelated lines are preserved. Task wording
and task locations change only when you explicitly edit or move a task.
Scheduling and completion re-find the original line before writing; if it moved, only a unique exact match is accepted. An edited or
ambiguous task is left untouched and a notice asks you to refresh.

Moves between notes cannot be atomic. TaskLoops writes the destination first,
then removes the original only if the source subtree still matches. On failure
it rolls back its destination write when safe. If another edit prevents a safe
rollback, both copies remain and a notice tells you to review them; no external
edit is overwritten.

## Upgrading from the GTD planner

The GTD lists, board, contexts, priorities and clarification wizard have been
removed. Tasks are now grouped by their source notes; old project links do not
move tasks between notes.

Previous plugin data is retained in `data.json` as a reversible backup. Existing
saved dates remain visible where task identities still match. An explicit
scheduling edit writes the new schedule into Markdown and removes that task's
old date fallback. No migration writes are made to notes automatically. Legacy
handled markers are recognized for display but never added or removed.

## Commands

- **Open planner**
- **Open planner in a main tab**
- **Add a task**
- **Refresh tasks**

## Installing

**From Obsidian** — open Settings → Community plugins → Browse, search for
**TaskLoops**, install and enable. This is the easiest route and gets you
updates automatically.
[Plugin page](https://obsidian.md/plugins?id=taskloops)

Requires Obsidian **1.7.2** or later, on desktop and mobile.

**From a release** — download `main.js`, `manifest.json` and `styles.css` from
the [releases page](../../releases) into
`<vault>/.obsidian/plugins/taskloops/`, then enable it under
Settings → Community plugins.

**From source** — clone this repo, then:

```bash
npm install
OBSIDIAN_VAULT="/path/to/your/vault" npm run deploy
```

To avoid repeating the path, write it once into a `.vault-path` file, which is
gitignored:

```bash
echo "/path/to/your/vault" > .vault-path
npm run deploy
```

`deploy` builds and copies only the three files Obsidian loads. It never touches
`data.json`, so settings and retained legacy data survive a redeploy. Scheduling
fields remain in the Markdown notes themselves.

## Development

```bash
npm install
npm run dev      # watch build
npm run build    # typecheck, lint, production build
npm test         # scanner, scheduling, calendar and vault-write checks
npm run deploy   # build, then copy plugin files into a vault
```

Source layout:

```text
src/
├── main.ts                   Obsidian lifecycle and dependency wiring
├── core/                     Pure task parsing, scheduling, dates and models
├── application/              Task actions interface and serialized task service
├── infrastructure/           Obsidian note repository and guarded transactions
└── gui/
    ├── calendar/             Calendar, resource timeline and Gantt adapters
    ├── components/           Task cards, sidebar, header and subtask controls
    ├── interactions/         Drag/drop and resizing controllers
    ├── modals/               Task dialogs, note pickers and shared form fields
    ├── obsidian/             Inline editor integration and settings tab
    ├── views/                Planner coordinator, Notes view and GUI state
    └── styles.css            Authored GUI styles
preview/                      Browser sample data, storage, actions and app entry
scripts/                      Build, stylesheet, preview, deploy and version tooling
test/                         Parsing, scheduling, service and vault-write checks
```

See [Architecture](docs/architecture.md) for dependency rules and where to make
changes. GUI components use the `TaskActions` interface, so the production plugin
and browser preview provide separate implementations of the same actions.

```bash
npm run format        # format source and preview files
npm run format:check  # verify formatting without changes
```

Tests bundle the plugin against a small Obsidian substitute. They cover field
round trips, supported date formats, invalid dates/times, overnight durations,
`Tasks:` insertion boundaries, code fences, CRLF preservation, stale or ambiguous
lines, queued rescheduling/completion, legacy date fallback, task editing, subtask
creation, existing task selection, subtree moves, multi-note rollback safety
duration resizing, note filters, scan-folder read boundaries, source navigation
and settings persistence. They do not
replace an in-app smoke test of native Obsidian drag and drop or mobile touch.

`main.js` is generated at the repository root; `manifest.json` and `styles.css`
ship alongside it. Build output and dependencies are ignored by Git.

## Releasing

Obsidian resolves a release by its git tag, which must be the bare version
number with **no `v` prefix**, and expects `main.js`, `manifest.json` and
`styles.css` attached individually as assets.

```bash
npm version patch
git push && git push --tags
```

`npm version` bumps `package.json`, then `version-bump.mjs` writes the same
version into `manifest.json` and adds a row to `versions.json`. The `.npmrc`
sets `tag-version-prefix=""`, which is what stops npm creating a `v0.1.1` style
tag — Obsidian would not resolve that.

Pushing the tag runs `.github/workflows/release.yml`, which installs, tests,
builds, verifies the tag matches `manifest.json`, attests build provenance, and
opens a **draft** release with `main.js`, `manifest.json` and `styles.css`
attached individually, plus the license. Review it and publish when ready.

`versions.json` maps each plugin version to the minimum Obsidian version it
needs, so older Obsidian installs resolve to a release they can actually run.

## Support

If TaskLoops is useful to you, you can
[buy me a coffee](https://buymeacoffee.com/sahandprs). Entirely optional — the
current release is free to use for personal and commercial work. Future
versions may have different terms or pricing.

## License

Copyright © 2026 Sahand Poursadeghi Khiavi.

**0.4.3 onward:** [GNU General Public License, version 3 only](LICENSE)
(`GPL-3.0-only`). Use, modification and redistribution, including commercial use,
are permitted under GPLv3. Distributing covered binaries requires supplying the
corresponding source under GPLv3's terms. Private modifications do not need to
be published. Copyright and license notices must be retained. See [NOTICE](NOTICE).

The matching source archive is attached to each release; the repository also
contains the build instructions and dependency lockfile. Your own notes and
tasks remain yours.

**Historical releases:** 0.4.1 and earlier retain their [MIT rights](licenses/MIT-previous-releases.txt).
0.4.2 was published under the [custom license preserved here](licenses/TaskLoops-0.4.2.txt).
The 0.4.3 release replaces that custom license with standard GPLv3.

## Calendar and Gantt preview

The planner uses **EventCalendar** for Day, Week, Month and resource **Timeline**
views, and **Frappe Gantt** for **Gantt**. Both libraries are MIT licensed.
The Year overview and Notes grid remain available. Click an event/bar to edit;
drag events or Gantt bars to reschedule, and resize their edges to adjust duration.
Timeline rows group tasks by source note; moving between rows does not move a task
to a different note. Choose its destination in the task editor instead.

All views share the same Markdown scheduling fields. Undated tasks remain in the
sidebar. Gantt uses the due date as the start and the inclusive deadline as the
end when one is set. Older tasks without deadlines continue to use duration.
Completion is binary (0% or 100%), and Gantt does not infer dependencies from note hierarchy.

To inspect the planner without launching Obsidian:

```bash
npm install
npm run preview
```

Open **http://127.0.0.1:5173/preview/**. This runs the actual planner and task
dialogs against sample notes, saved in browser local storage. Use **Reset sample
tasks** to start over. It does not read or modify an Obsidian vault. Native vault
operations still need testing inside Obsidian. The production build combines the
two libraries' styles and `src/gui/styles.css` into the root `styles.css`.


### Deadlines and multi-day spans

Set **Due date** to the first day and **Deadline** to the last day in the task
editor. The deadline is inclusive: October 20 through October 22 fills three
days. A deadline cannot precede its due date.

Calendar shows multi-day tasks as a stretched bar in the all-day row, even if
they have a start time. Gantt uses the same date span. Duration is retained as
separate effort and does not determine the span when a deadline is set. Moving
a range moves both dates; resizing its edge updates the deadline. Tasks without
a deadline retain their existing time/duration behavior.

The fields remain ordinary Markdown, for example:

```markdown
- [ ] Prepare release - Due date: 2026-10-20 Time: 10:00 Duration: 1 Hour 30 Minutes Deadline: 2026-10-22
```

Clear only Deadline to return to time/duration scheduling, or use **Remove
schedule** to clear all scheduling fields. Existing notes are not auto-migrated.
