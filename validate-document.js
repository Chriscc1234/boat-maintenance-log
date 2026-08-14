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
      if (it.role != null && !["goal","step","bottleneck","after-launch"].includes(it.role))
        E(`${iat}.role "${it.role}" is not a known role`);
      if (it.role === "step" && it.type !== "task")
        E(`${iat} has role "step" but is a note — steps must be tasks to be tickable`);
      if (it.role != null && !isCp)
        W(`${iat} has role "${it.role}" but its entry is not the critical path, so it renders as a plain bullet`);
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
