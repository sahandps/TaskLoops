# TaskLoops

[![Obsidian plugin](https://img.shields.io/badge/Obsidian-TaskLoops-7c3aed?logo=obsidian&logoColor=white)](https://obsidian.md/plugins?id=taskloops)
[![Release](https://img.shields.io/github/v/release/sahandps/TaskLoops?sort=semver)](https://github.com/sahandps/TaskLoops/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An Obsidian plugin that collects `#task` lines from anywhere in your vault into
a sidebar inbox, walks them through the GTD clarify flow, and marks each line
`*(Handled)*` once you've sorted it.

An *open loop* is anything you've committed to that isn't closed yet. TaskLoops
finds them, helps you file them, and tells you when a project has quietly
stalled.

## What it writes to your notes

Two things, both of which you trigger deliberately:

1. **`*(Handled)*`** appended to the end of a task's own line, once you sort it.
   Turn off **Mark lines when sorted** and this stops entirely.
2. **The sentence of a task you explicitly edit**, and only that — see
   [Editing a task](#editing-a-task).
3. **A new `- … #task` line appended to your capture note**, and only when you
   use quick capture. That note is named in settings, defaults to
   `TaskLoops Inbox.md`, and is created on first use. Capture only ever appends
   to the end of that one file.

Beyond those, nothing. It never touches frontmatter or note properties, never
adds tags, never reorders or moves lines, never deletes anything, and never
edits a line you have not personally sorted or edited. If you never press the capture
button, the capture note is never created.

All state — bucket, context, delegate, date, project links, done — lives in the
plugin's own `data.json`, never in your notes.

## The clarify flow

Standard GTD, one question at a time:

1. **Is it actionable?** No leads to Trash, Someday/Maybe or Reference.
2. **Under two minutes?** Yes means do it now; it is filed as done immediately.
3. **What kind of thing is it?** Next action (pick a context), Project
   (multi-step), Delegate (name the person), or Schedule (pick a date).

You can back out of any step, and re-file anything later from the `⋯` menu.

## Capture

The **+** button in the panel header opens a capture row. Type, press Enter, and
the line is appended to your capture note and appears in the Inbox unsorted —
the row stays open so a burst of thoughts costs one keystroke each. Escape
closes it. There is also a *Capture a task to the inbox* command you can bind to
a hotkey.

The first time you capture anything, you are asked which folder captures should
live in, and `TaskLoops Inbox.md` is created there. Dismissing that prompt is a
valid answer — it puts the note at the vault root. You are only asked once; the
capture row shows the destination underneath it, and clicking it moves the
capture note somewhere else at any time.

## Projects

The projects list stays a list of *outcomes*, not a place to keep steps. The
plugin tracks one thing about a project: which actions belong to it, so it can
tell you when a project has nothing open against it. A project showing **no next
action** has stalled, which is the single failure mode the weekly review exists
to catch. Those projects sort to the top and put a dot on the Projects tab.

Actions get attached to a project three ways:

1. **Indentation.** A `#task` line indented under a project's `#task` line is
   its action. Blank lines are transparent; any non-blank line at column zero
   ends the block, so an outline further down the note won't attach itself to
   something unrelated. This is read-only inference — nothing is written.
2. **During clarify.** If you have projects and the task isn't already
   attached, the last step of the flow offers them. Indented tasks skip this
   step, because the answer is already known.
3. **Afterwards**, via `⋯` → *Part of project…*.

Expanding a project shows its actions one level deep. There is no nesting beyond
that, and a project can't belong to another project — choosing *Standalone* pins
a task as unattached even if it sits under a project in the outline.

A project whose only children are unclarified inbox items still counts as
stalled. That is deliberate: an uncaptured thought is not something you can act
on.

## Editing a task

Double-click a task's text in the panel to rewrite it, or use `⋯` → *Edit text*.
Enter saves, Escape cancels, Shift+Enter adds a line break.

This is the one place the plugin rewrites something you wrote, so it is careful
about it: only the sentence changes. The line's indentation, bullet, checkbox,
blockquote or heading markers, the tag exactly as you wrote it — `#task/work`
stays `#task/work` — any block id, and the handled marker are all preserved.
Before writing, the line is re-located by its exact previous text, so an edit
made in the note meanwhile cannot cause the wrong line to be rewritten.

Renaming changes a task's identity, since identity is derived from its text.
The record is moved across explicitly, so its bucket, context, date and project
links all survive.

The context, waiting-on and date chips under each task are clickable: one click
changes any of them. Empty ones appear on hover as `+ context` and `+ date`, and
on touch they live on the `⋯` menu instead.

## Dragging

Drag any task onto a tab to file it there. Buckets that are hidden when empty
appear while you drag. Dropping onto **Scheduled** asks for a date and dropping
onto **Waiting** asks for a name, because those buckets are meaningless without
them; every other bucket files immediately. Dropping a task onto a project card
files it under that project.

Dragging a task onto another task within the same list sets a manual order —
the line across the card shows where it will land. Ordering is stored in the
plugin's data, so the order of lines in your notes is never touched. Lists you
have never reordered keep sorting by most recently filed.

Dragging is mouse-only — it uses HTML5 drag events, which touch screens don't
fire. Every drag action is also on the `⋯` menu, which is the path to use on a
phone.

## Dates

Every task row has a date chip. Click it to set, change or clear the date —
there are Today / Tomorrow / In a week shortcuts plus a picker. The same is on
the `⋯` menu. Setting a date on a task that isn't scheduled moves it onto the
calendar; clearing it leaves the task where it is.

## How lines are found

Tag positions come from Obsidian's own metadata cache, not a text search, so
fenced code blocks, inline code and YAML frontmatter are excluded automatically.
`#task/work` and other child tags count. A line holding nothing but the tag is
ignored. Bullets, checkboxes, ordered lists, blockquotes, headings and block ids
are stripped from the display text but left untouched in the note.

## Identity and edit safety

A task is identified by a hash of its note path, its cleaned text, and its index
among identical lines in that file. Two consequences worth knowing:

- **Editing a sorted line's wording gives it a new identity.** When exactly one
  record in a note is orphaned and exactly one marked line there has no record,
  that is unambiguously a rewording, and the record moves across intact — so a
  reworded project keeps the actions pointing at it. Project links survive this
  because they reference an internal id, not the line's text. If the match is
  ambiguous, the line falls back to **Next**, where it stays visible rather than
  silently vanishing.
- **Deleting a task line drops its record.** This only happens after a full,
  successful vault scan, so a partial view can never prune anything.

Before writing a marker the plugin re-locates the line by its exact prior text.
If the line moved and the text is still unique, it follows it; if it cannot
identify the line unambiguously, it writes nothing and tells you.

Renaming or moving a note carries its filed tasks along with it.

## Layout

The panel sizes itself against **its own width**, not the window's, using a CSS
container query — a desktop sidebar is often narrower than a phone screen, so
viewport media queries would tune the wrong thing. Below about 290px the tab
labels drop and the rail becomes icons and counts.

Touch devices get larger targets and lose nothing to hover: the `⋯` button is
always visible rather than fading in, and the hover-only "add a date" chip is
hidden outright, since its actions live on the `⋯` menu anyway. Verified with no
horizontal overflow down to a 260px panel.

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
`data.json`, so your sorting survives a redeploy.

## Development

```bash
npm install
npm run dev      # watch build
npm run build    # typecheck + minified build
npm test         # 79 tests over the scanner
npm run deploy   # build, then copy into a vault
```

Source layout:

```
src/
├── main.ts       plugin lifecycle, state, reconciliation, filing actions
├── scanner.ts    finding tagged lines, identity, the one write path
├── view.ts       sidebar: tabs, lists, cards, projects, drag and drop
├── wizard.ts     the GTD clarify flow
├── modals.ts     folder, project, task and date pickers
├── settings.ts   settings pane
├── types.ts      buckets, stored shapes, defaults
├── dates.ts      calendar-day helpers
└── text.ts       string helpers
scripts/          build tooling: deploy, version bump
test/             node test suite over scanner.ts
```

`main.js` is built to the repository root, because that is where Obsidian loads
it from and where the release workflow picks it up. `styles.css` and
`manifest.json` stay at the root for the same reason — they ship verbatim rather
than being compiled.

The tests cover the risky parts: which lines count as tasks, how identity is
derived, how indentation implies a parent, and that marking a line is idempotent
and reversible without disturbing its indent, bullet or checkbox.

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
attached individually. Review it and publish when ready.

`versions.json` maps each plugin version to the minimum Obsidian version it
needs, so older Obsidian installs resolve to a release they can actually run.

## Support

If TaskLoops is useful to you, you can
[buy me a coffee](https://buymeacoffee.com/sahandprs). Entirely optional — the
plugin is free and always will be.

## License

MIT © Sahand Poursadeghi Khiavi
