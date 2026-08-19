#!/usr/bin/env node
//
// validate-document.js — check a log document against schema v1 (DATA-FORMAT.md)
//
//   node validate-document.js document.json
//
// The app runs these same checks on import. Anything that would make the app
// render wrong, render nothing, or silently drop data is an ERROR. Anything
// merely untidy is a WARNING and does not block.
//
// Exported as a function so the shell can use the identical logic rather than a
// second, drifting copy — one implementation, two callers.

const SCHEMA_VERSION = 1;
const HEX = /^#[0-9a-fA-F]{6}$/;
const SORTKEY = /^\d{4}-\d{2}-\d{2}[a-z]?$/;

function validateDocument(doc) {
  const errors = [], warnings = [];
  const E = m => errors.push(m);
  const W = m => warnings.push(m);

  if (doc === null || typeof doc !== "object" || Array.isArray(doc))
    return { errors: ["document is not a JSON object"], warnings };

  // ── shape ───────────────────────────────────────────────────────────────
  if (doc.schemaVersion !== SCHEMA_VERSION)
    E(`schemaVersion is ${JSON.stringify(doc.schemaVersion)}, expected ${SCHEMA_VERSION}`);

  for (const [k, kind] of [["document","object"],["vessel","object"],["settings","object"],
                           ["systems","array"],["priorities","array"],["entries","array"],
                           ["voyages","array"],["revisions","array"],["notes","string"]]) {
    const v = doc[k];
    const ok = kind === "array" ? Array.isArray(v)
             : kind === "string" ? typeof v === "string"
             : v !== null && typeof v === "object" && !Array.isArray(v);
    if (!ok) E(`${k} is missing or not ${kind === "array" ? "an array" : "a " + kind}`);
  }
  if (errors.length) return { errors, warnings };   // nothing below is safe yet

  if (!doc.vessel.name) E("vessel.name is empty — the app has nothing to call the boat");
  if (!doc.document.revision) W("document.revision is empty");

  // ── systems ─────────────────────────────────────────────────────────────
  const sysIds = new Set();
  doc.systems.forEach((s, i) => {
    const at = `systems[${i}]`;
    if (!s.id) return E(`${at}.id is empty`);
    if (sysIds.has(s.id)) E(`${at}: duplicate system id "${s.id}"`);
    sysIds.add(s.id);
    if (!s.name) E(`${at} ("${s.id}") has no name`);
    if (s.color != null && !HEX.test(s.color)) E(`${at} ("${s.id}") colour "${s.color}" is not #RRGGBB`);
  });
  doc.systems.forEach((s, i) => {
    if (s.parent == null) return;
    if (!sysIds.has(s.parent)) return E(`systems[${i}] ("${s.id}") parent "${s.parent}" does not exist`);
    if (s.parent === s.id) return E(`systems[${i}] ("${s.id}") is its own parent`);
    // One level only. Filtering walks parent→children exactly once, so a
    // grandchild would silently never appear under its grandparent's filter.
    const p = doc.systems.find(x => x.id === s.parent);
    if (p && p.parent != null)
      E(`systems[${i}] ("${s.id}") nests under "${p.id}", which is itself a child — only one level is supported`);
  });

  // ── priorities ──────────────────────────────────────────────────────────
  const priIds = new Set();
  doc.priorities.forEach((p, i) => {
    const at = `priorities[${i}]`;
    if (!p.id) return E(`${at}.id is empty`);
    if (priIds.has(p.id)) E(`${at}: duplicate priority id "${p.id}"`);
    priIds.add(p.id);
    if (!p.label) E(`${at} ("${p.id}") has no label`);
    if (p.color != null && !HEX.test(p.color)) E(`${at} ("${p.id}") colour "${p.color}" is not #RRGGBB`);
  });

  // ── entries ─────────────────────────────────────────────────────────────
  const ids = new Set();
  let criticalPaths = 0;

  const checkItems = (items, at, isCp) => {
    if (!Array.isArray(items)) return E(`${at}.items is not an array`);
    items.forEach((it, j) => {
      const iat = `${at}.items[${j}]`;
      if (it === null || typeof it !== "object") return E(`${iat} is not an object`);
      if (it.type !== "task" && it.type !== "note")
        return E(`${iat}.type is ${JSON.stringify(it.type)}, expected "task" or "note"`);
      if (typeof it.text !== "string") E(`${iat}.text is missing or not a string`);
      if (it.type === "task" && typeof it.done !== "boolean")
        E(`${iat} is a task but done is ${JSON.stringify(it.done)}, expected true or false`);
      if (it.type === "note" && "done" in it && it.done != null)
        W(`${iat} is a note but carries done — it will not render a checkbox`);
      // doneAt is machine-written — stamped when a task is ticked in the app and
      // removed when it is unticked. It is the only time signal the log has, so
      // a wrong one is worse than none: it would be averaged into a rate.
      if ("doneAt" in it && it.doneAt != null){
        if (it.type !== "task" || !it.done)
          W(`${iat} carries doneAt but is not a completed task — it will be ignored`);
        else if (typeof it.doneAt !== "string" || isNaN(Date.parse(it.doneAt)))
          E(`${iat}.doneAt is ${JSON.stringify(it.doneAt)}, expected an ISO date string`);
      }
      if (it.role != null && !["goal","step","bottleneck","after-launch"].includes(it.role))
        E(`${iat}.role "${it.role}" is not a known role`);
      if (it.role === "step" && it.type !== "task")
        E(`${iat} has role "step" but is a note — steps must be tasks to be tickable`);
      if (it.role != null && !isCp)
        W(`${iat} has role "${it.role}" but its entry is not the critical path, so it renders as a plain bullet`);
      // A leading ☐/☑ is how the OLD format carried task state, inside the text.
      // Left in place it renders next to the checkbox the app draws from `done`,
      // so the line shows two boxes that can disagree with each other.
      if (typeof it.text === "string" && /^\s*[☐☑]/.test(it.text))
        W(`${iat}.text starts with a checkbox character — task state belongs in done, not in the text`);
    });
  };

  doc.entries.forEach((e, i) => {
    const at = `entries[${i}]` + (e && e.id ? ` ("${e.id}")` : "");
    if (e === null || typeof e !== "object") return E(`entries[${i}] is not an object`);
    if (!e.id) return E(`entries[${i}].id is empty`);
    if (ids.has(e.id)) E(`${at}: duplicate entry id`);
    ids.add(e.id);

    if (!e.title) E(`${at} has no title`);
    if (!sysIds.has(e.system)) E(`${at} system "${e.system}" does not exist in systems`);
    if (e.status !== "active" && e.status !== "complete")
      E(`${at} status is ${JSON.stringify(e.status)}, expected "active" or "complete"`);
    if (e.priority != null && !priIds.has(e.priority))
      E(`${at} priority "${e.priority}" does not exist in priorities`);
    if (!e.sortKey) E(`${at} has no sortKey — it cannot be placed in the log`);
    else if (!SORTKEY.test(e.sortKey))
      W(`${at} sortKey "${e.sortKey}" is not YYYY-MM-DD with an optional letter suffix`);

    if (e.role != null && e.role !== "critical-path")
      E(`${at} role "${e.role}" is not a known entry role`);
    if (e.role === "critical-path") criticalPaths++;

    // A blocked job whose reason is missing is the one case the Focus tab has
    // nothing useful to show — the card exists to answer "why is this stuck".
    if (e.priority === "blocked" && !e.waitingOn)
      W(`${at} is blocked but has no waitingOn, so the card cannot say why`);

    checkItems(e.items, at, e.role === "critical-path");
  });

  if (criticalPaths > 1)
    E(`${criticalPaths} entries have role "critical-path" — only one can be pinned`);

  // The app sorts on read, so an out-of-order file still displays correctly.
  // It is reported anyway because a hand-edited file that disagrees with the
  // order on screen is confusing to edit again, and it usually means a new
  // entry was appended rather than placed.
  for (let i = 1; i < doc.entries.length; i++) {
    const a = doc.entries[i-1], b = doc.entries[i];
    if (a && b && a.sortKey && b.sortKey && a.sortKey.localeCompare(b.sortKey) > 0) {
      W(`entries are not in sortKey order — "${b.id}" (${b.sortKey}) follows ` +
        `"${a.id}" (${a.sortKey}). The app sorts on read, so this is cosmetic.`);
      break;
    }
  }

  // ── plan ────────────────────────────────────────────────────────────────
  // Optional and top level. The plan is not a job — it is a view over jobs — so
  // it does not live in `entries`, where it was inflating the job count, sitting
  // in somebody's category, and carrying a sortKey and a date that meant
  // nothing. Documents written before this carry an entry with
  // role:"critical-path" instead; the app converts those on open.
  if (doc.plan != null){
    const p = doc.plan;
    if (typeof p !== "object" || Array.isArray(p)) E("plan is not an object");
    else {
      if (p.heading != null && typeof p.heading !== "string") E("plan.heading is not a string");
      if (p.goal != null && typeof p.goal !== "string") E("plan.goal is not a string");
      if (p.bottleneck != null && typeof p.bottleneck !== "string") E("plan.bottleneck is not a string");
      if (p.notes != null && !Array.isArray(p.notes)) E("plan.notes is not an array");
      else (p.notes || []).forEach((n, i) => {
        if (typeof n !== "string") E(`plan.notes[${i}] is not a string`);
      });
      if (!Array.isArray(p.steps)) E("plan.steps is missing or not an array");
      else p.steps.forEach((s, i) => {
        const at = `plan.steps[${i}]`;
        if (s === null || typeof s !== "object") return E(`${at} is not an object`);
        if (typeof s.text !== "string") E(`${at}.text is missing or not a string`);
        if (typeof s.done !== "boolean")
          E(`${at}.done is ${JSON.stringify(s.done)}, expected true or false`);
        // A step may name the jobs that do the work. Optional — plenty of steps
        // are not any one job — but a name that points nowhere is a dead link.
        //
        // An ARRAY, because a step routinely spans jobs: "all 8 through-hulls in"
        // is two separate jobs on this boat. `entryId` (singular) was the first
        // shape and is still read; the app rewrites it to `entryIds` on open.
        if (s.entryIds != null && !Array.isArray(s.entryIds))
          E(`${at}.entryIds is not an array`);
        else for (const jid of (s.entryIds || [])){
          if (typeof jid !== "string") E(`${at}.entryIds holds a non-string`);
          else if (!ids.has(jid)) E(`${at}.entryIds names "${jid}", which is not an entry in this log`);
        }
        if (s.entryId != null){
          if (!ids.has(s.entryId)) E(`${at}.entryId "${s.entryId}" is not an entry in this log`);
          else if ((s.entryIds || []).length)
            W(`${at} has both entryId and entryIds — entryId is the old single-job form and will be folded in`);
        }
      });
    }
    if (criticalPaths)
      E(`the document has a plan AND ${criticalPaths} entr${criticalPaths>1?"ies":"y"} ` +
        `with role "critical-path" — one or the other, not both`);
  }

  // ── voyages ─────────────────────────────────────────────────────────────
  const vids = new Set();
  doc.voyages.forEach((v, i) => {
    const at = `voyages[${i}]` + (v && v.id ? ` ("${v.id}")` : "");
    if (v === null || typeof v !== "object") return E(`voyages[${i}] is not an object`);
    if (!v.id) return E(`voyages[${i}].id is empty`);
    if (vids.has(v.id)) E(`${at}: duplicate voyage id`);
    if (ids.has(v.id)) W(`${at}: id is also used by an entry`);
    vids.add(v.id);
    if (!v.sortKey) E(`${at} has no sortKey`);
    checkItems(v.items, at, false);
  });

  // ── revisions ───────────────────────────────────────────────────────────
  const seen = new Set();
  doc.revisions.forEach((r, i) => {
    const at = `revisions[${i}]`;
    if (r === null || typeof r !== "object") return E(`${at} is not an object`);
    if (!r.version) E(`${at}.version is empty`);
    else if (seen.has(r.version)) W(`${at}: duplicate revision "${r.version}"`);
    else seen.add(r.version);
    if (typeof r.text !== "string" || !r.text) E(`${at} ("${r.version}") has no text`);
  });

  if (doc.document.revision && doc.revisions.length &&
      doc.revisions[0].version !== doc.document.revision)
    W(`document.revision is "${doc.document.revision}" but the newest revisions row is ` +
      `"${doc.revisions[0].version}" — revisions must be newest-first`);

  const orphanSys = [...sysIds].filter(id => !doc.entries.some(e => e.system === id));
  if (orphanSys.length)
    W(`categories with no entries (hidden from the filter bar): ${orphanSys.join(", ")}`);

  return { errors, warnings };
}

// ── CLI ───────────────────────────────────────────────────────────────────
if (typeof module !== "undefined" && require.main === module) {
  const fs = require("fs");
  const file = process.argv[2] || "document.json";
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`${file}: not readable as JSON — ${err.message}`);
    process.exit(2);
  }

  const { errors, warnings } = validateDocument(doc);

  console.log(`── validate ${file} — schema v${SCHEMA_VERSION} ──`);
  if (doc && doc.entries) {
    console.log(`  ${doc.entries.length} entries · ${(doc.voyages||[]).length} voyages · ` +
      `${(doc.systems||[]).length} systems · ${(doc.revisions||[]).length} revisions`);
  }
  for (const w of warnings) console.log(`  warning: ${w}`);
  for (const e of errors)   console.log(`  ERROR  : ${e}`);

  if (errors.length) {
    console.log(`\n  ${errors.length} error(s) — this document would not import.`);
    process.exit(1);
  }
  console.log(warnings.length
    ? `\n  ok — ${warnings.length} warning(s), nothing blocking.`
    : `\n  ok — no problems found.`);
}

if (typeof module !== "undefined") module.exports = { validateDocument, SCHEMA_VERSION };
