# The log document format — schema v1

This describes the single JSON file that holds everything about one vessel: its
details, its categories, its jobs, its voyages and its history. The app is
generic; this file is what makes it *your boat's* log.

**Written to be read with no other context.** If you are an AI being asked to add
or edit entries in someone's maintenance log, everything you need is here. If you
are a person, the same — the format is meant to be legible and hand-editable.

---

## How the file is used

```
export  →  edit (by hand, or by an AI, or in the app)  →  import
```

The app can export this file and import it back. Importing **replaces the whole
document**, so edit the exported file rather than writing one from scratch — that
way ids, history and settings survive.

Validate before importing:

```bash
node validate-document.js document.json
```

The app runs the same checks on import and will refuse a document that fails
them. It is better to see the error in a terminal than to have an import
rejected with the file half-understood.

---

## Top level

```json
{
  "schemaVersion": 1,
  "document":   { ... },
  "vessel":     { ... },
  "settings":   { ... },
  "systems":    [ ... ],
  "priorities": [ ... ],
  "entries":    [ ... ],
  "voyages":    [ ... ],
  "revisions":  [ ... ],
  "notes":      "markdown string"
}
```

Every key is required. `schemaVersion` must be `1`; the app uses it to decide
whether a document needs migrating before it can be read, so never change it by
hand.

---

## `document` — what version of the log this is

```json
"document": {
  "revision": "v2.3",
  "revisionDate": "12 Aug 2026",
  "updatedAt": "2026-08-14T05:33:29.226Z",
  "convertedAt": "2026-08-13",
  "convertedFrom": { "file": "...", "sha256": "..." }
}
```

`updatedAt` is stamped by the app on every edit. Leave it alone when editing by
hand — it records when the document last changed, not when you touched the file.

`revision` is the **log's** version, not the app's. They are different numbers
and must not be conflated: the app updates itself on its own schedule and must
never renumber someone's log. Bump `revision` when the content changes
meaningfully, and add a matching row to `revisions`.

`convertedFrom` is provenance from the original one-off conversion. It is
informational and may be absent.

---

## `vessel` — who the boat is

```json
"vessel": {
  "name": "Wandering Star",
  "make": "Grand Banks",
  "model": "36 Classic",
  "year": "1984",
  "hullType": "Trawler",
  "homePort": "Shilshole Bay, Seattle WA",
  "berth": "Dock C, Slip 42",
  "currentLocation": "Hauled out — bottom job",

  "headerLabel":  "WANDERING STAR · GRAND BANKS 36 · 1984",
  "footerLabel":  "GRAND BANKS 36 · 1984 · MAINTENANCE LOG",
  "logTitle":     "Master Maintenance Log",
  "pageTitle":    "Wandering Star · Maintenance Log",
  "appName":      "Wandering Star — Maintenance Log",
  "appShortName": "Wandering Star",
  "appDescription": "Maintenance log and voyage record for Wandering Star.",

  "icon": "data:image/png;base64,iVBORw0KGgo..."
}
```

The first block is the boat. The second block is the text the app displays —
browser tab, page header, lock screen, footer, and the home-screen app name.
They are separated because they change for different reasons: renaming the boat
is one edit, restyling the header is another.

`name` is required. Everything else may be an empty string.

`icon` is optional — the owner's own picture of the boat, as a PNG data URI. The
app squares and re-encodes anything uploaded to 512×512 before storing it, so it
stays around 300KB rather than the several megabytes a phone photo arrives as.
Leave it out and the app uses its own stock icon. **If you are editing this file
by hand, do not hand-write this field** — it is long, and getting it wrong shows
up as a broken image rather than an error.

---

## `systems` — the categories

```json
"systems": [
  { "id": "engines",      "name": "Engines",      "color": "#F87171", "parent": null,      "order": 0 },
  { "id": "port-engine",  "name": "Port Engine",  "color": "#F87171", "parent": "engines", "order": 1 }
]
```

- `id` — stable, lower-case, hyphenated. **Entries reference this, not the name**,
  so a category can be renamed without orphaning every job filed under it.
  Never change an id on an existing category.
- `name` — what is displayed. Change freely.
- `color` — `#RRGGBB`. Shown as the dot on each entry and each filter chip.
- `parent` — another system's `id`, or `null`. Filtering a parent includes its
  children, which is how "Engines" also shows Port and Starboard. **One level
  only:** a system with a parent cannot itself be a parent.
- `order` — display order in the filter bar. Put children directly after their
  parent.

**To add a category:** append an object with a new unique id. Nothing else needs
to change. To delete one, first move or delete every entry that references it —
the validator will tell you if you miss any.

---

## `priorities` — the Focus tab's groups

```json
"priorities": [
  { "id": "now",     "label": "Working on now",    "color": "#34D399", "order": 0 },
  { "id": "next",    "label": "Next up",           "color": "#38BDF8", "order": 1 },
  { "id": "blocked", "label": "Blocked / waiting", "color": "#FB923C", "order": 2 },
  { "id": "later",   "label": "Postponed",         "color": "#64748B", "order": 3 }
]
```

Same rules as systems: `id` is referenced by entries and should not change,
`label` and `color` are yours. `order` is the order the groups appear on the
Focus tab.

---

## `entries` — the jobs

This is the bulk of the file.

```json
{
  "id": "e012",
  "title": "Raw-Water Pump — Weeping at the Seal",
  "system": "engines",
  "status": "active",
  "priority": "next",
  "waitingOn": null,
  "sortKey": "2026-04-18",
  "year": "2026",
  "dateLabel": "Apr 2026 — ongoing",
  "role": null,
  "items": [
    { "type": "note", "text": "Pump is a Sherwood G-Series, belt driven off the crank.", "role": null },
    { "type": "task", "done": false, "text": "Order a rebuild kit before the next haul-out.", "role": null }
  ]
}
```

| field | meaning |
|---|---|
| `id` | unique, stable. Convention is `e001`, `e002`… but any unique string works. Never reuse a deleted id. |
| `title` | short name of the job |
| `system` | a `systems[].id` |
| `status` | `"active"` or `"complete"` |
| `priority` | a `priorities[].id`, or `null`. Only entries with a priority appear on the Focus tab. |
| `waitingOn` | why it is blocked, or `null`. Shown on the card so the reason is visible without opening it. |
| `sortKey` | orders the log. `YYYY-MM-DD`, with an optional letter suffix (`2026-07-20b`) to break ties. |
| `year` | the year heading it files under |
| `dateLabel` | the human date, free text — `"Nov 2024 — ongoing"`, `"Jun 12, 2026"` |
| `role` | `"critical-path"` on at most one entry, otherwise `null` |
| `items` | the body — see below |

### An entry is a job, not a step

This is the rule that keeps the log honest. An entry stays `"active"` until the
part is physically back on the boat and working. "Rudders removed and coated" is
not a completed job — the rudders are on the shop floor.

Steps within a job are `task` items, not separate entries.

### `items` — the body of an entry

Two kinds:

```json
{ "type": "note", "text": "Free text. A fact, or a decision with its reason." }
{ "type": "task", "done": false, "text": "Something to do." }
```

`done` is required on tasks and must be a boolean. It is what draws the
checkbox; the app counts open tasks from it.

**Write bullets as facts, decisions or actions — nothing else.** Not commentary,
not replies to a conversation, not analysis out loud. If a bullet only makes
sense to someone who was in the discussion, it does not belong.

### `role` on items, and the critical path

`role` is normally `null`. It matters on the one entry with
`"role": "critical-path"`, which the app pins to the top of the Focus tab:

| item role | shown as |
|---|---|
| `"goal"` | the objective line under the heading |
| `"step"` | the numbered gate list — always `task` items |
| `"bottleneck"` | the callout at the bottom |
| `"after-launch"` | a plain note; things explicitly *not* gating |
| `null` | a plain note |

If no entry has `"role": "critical-path"`, the Focus tab simply has no pinned
block. That is fine and is the normal state for a new log.

---

## `voyages` — runs and journeys

Separate from entries on purpose: a voyage is an event that completes on tie-up,
not a job that stays open.

```json
{
  "id": "v001",
  "sortKey": "2024-11-03",
  "year": "2026",
  "dateLabel": "Nov 3, 2024",
  "from": "Seattle (Shilshole Bay)",
  "to": "Port Townsend",
  "purpose": "Shakedown after the winter",
  "crew": "not recorded",
  "distance": "~38 nm",
  "underway": "~5 hrs",
  "hoursPort": "not recorded",
  "hoursStbd": "not recorded",
  "fuelUsed": "not recorded",
  "weather": "not recorded",
  "seaState": "not recorded",
  "items": [ ... ]
}
```

Every field except `id`, `sortKey` and `items` is free text and may be empty.
`"not recorded"` is a perfectly good value and is better than a guess — an empty
field reads as "not filled in yet", which is a different claim.

Voyages sort newest-first; entries sort oldest-first.

---

## `revisions` — the changelog

```json
[
  { "version": "v2.3", "date": "12 Aug 2026",
    "text": "Long description of what changed and why.",
    "headline": "Short summary shown when the row is collapsed" }
]
```

**Newest first.** `headline` is the collapsed one-line summary; `text` is the
full entry shown when the row is expanded. `headline` may be `null` on old rows,
in which case the row shows expanded.

Add a row whenever `document.revision` is bumped.

---

## `notes` — build and handoff notes

A markdown string, rendered on the Updates tab under the revision history. A
small subset is supported: `##` headings become collapsible sections, plus
`**bold**`, `` `code` ``, fenced code blocks, lists and links.

May be an empty string.

---

## If you are an AI editing this file

Read this whole document first, then:

1. **Edit the exported file. Do not write a new one.** Ids, revision history and
   settings are all in there and all matter.
2. **Never reuse an id**, including one belonging to a deleted entry.
3. **Reference systems and priorities by `id`**, and check the id exists.
4. **Keep `entries` sorted by `sortKey`** ascending. If you add an entry with a
   date that collides, use a letter suffix (`2026-07-20b`).
5. **Bump `document.revision` and add a `revisions` row** if you changed
   anything a reader would care about. Say what changed and why, not what you
   did to the file.
6. **Run the validator**, and fix what it reports:
   ```bash
   node validate-document.js document.json
   ```
7. **Say what you changed** in your reply — entry ids and fields. The person
   importing it cannot diff it in their head.

Things that are *not* yours to change unless asked: `schemaVersion`, existing
ids, and the `convertedFrom` block.
