# TaskLoops code organization

`src/main.ts` is the Obsidian entry point. It wires services and GUI together,
registers commands and listeners, maintains scanned task state, and opens views.

## Layers and dependencies

| Folder | Responsibility | Dependency rule |
| --- | --- | --- |
| `src/core` | Task models, Markdown parsing, schedule calculations, note grouping, settings validation | Imports only other core modules; no DOM, Obsidian or GUI library imports |
| `src/application` | Task commands, write serialization, task editing and move workflows | Uses core functions and the Obsidian repository; never imports GUI |
| `src/infrastructure` | Vault reads/writes, metadata-backed discovery, guarded transactions and vendor type declarations | Uses core; never imports GUI |
| `src/gui` | Rendering, dialogs, user interaction and calendar library integration | Calls the `TaskActions` interface; host-specific Obsidian integrations also use the plugin |
| `preview` | Browser adapter, sample data and local persistence | Reuses the real GUI and core; supplies its own task actions |

`TaskActions` describes what the interface can do: list, create, edit, complete,
and schedule tasks, open notes, and save settings. It has no dependency on the
plugin class. `TaskLoopsPlugin` and the browser preview implement this surface.

`TaskService` owns the write queue and task mutations. The plugin passes its
host operations through callbacks so the service does not need a view, modal,
or plugin instance. Keep validation and Markdown transforms in `core`, and
keep actual note access in `infrastructure`.

## GUI modules

- `views/taskloops-view.ts`: owns view state, coordinates rendering, restores
  scroll/focus, and disposes calendar and divider instances.
- `views/notes-view.ts`: renders the searchable note grid.
- `components`: renders the header, sidebar, reusable task card and subtask editor.
- `interactions/task-drag-controller.ts`: owns sidebar drag state and drop wiring.
- `modals`: one class per task dialog or picker. Shared schedule and project
  fields are separate functions. `modals/index.ts` provides convenient exports.
- `calendar/planner.ts`: dispatches to the Calendar or Gantt renderer.
- `calendar/event-calendar-view.ts`: owns EventCalendar and its callbacks.
- `calendar/gantt-view.ts`: owns the Frappe Gantt integration.
- `calendar/task-gantt.ts`: isolates Frappe's midnight-end compatibility behavior.
- `calendar/calendar-view.ts`: coordinates calendar navigation and the Year view.

Pure date conversions for both libraries live in `core/planner-schedule.ts`.
A library callback converts its event into a `Schedule`, then calls the shared
schedule action. Neither library writes Markdown directly.

## Browser preview

`preview/main.mjs` only starts the app and wires dependencies. The other files
have separate responsibilities:

- `sample-data.mjs`: sample task factory and fixtures.
- `task-store.mjs`: browser local storage and reset behavior.
- `task-actions.mjs`: preview implementation of task actions.
- `note-preview.mjs`: sample note dialog.
- `obsidian.mjs`: browser substitutes for the Obsidian classes used by the GUI.
- `dom.mjs`: DOM helpers normally supplied by Obsidian.

The preview retains the same local-storage key, so existing sample tasks survive
this refactor. It never accesses an actual vault.

## Building and checking

```bash
npm test
npm run build
npm run format:check
npm run preview
```

The preview is served at `http://127.0.0.1:5173/preview/`.
`scripts/styles.mjs` combines vendor styles and `src/gui/styles.css` into the
root `styles.css` for both builds. Vendor selectors and their root variables are
scoped by `scripts/vendor-styles.mjs` to the planner; theme variables are mapped
on the Calendar and Gantt components themselves. Edit the GUI source stylesheet, then restart
the preview or rebuild to regenerate the output.

The tests use an Obsidian substitute to exercise parsing, scheduling and safe
vault operations. Native Obsidian integration still needs an in-app smoke test.
