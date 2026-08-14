# Boat Maintenance Log

A maintenance log for a vessel that lives on your phone, tablet and laptop, works
with **no signal at all**, and belongs entirely to you.

- Jobs, tasks, categories, voyages and boat details — all editable in the app
- Works offline. It is built for a boatyard and a helm, where there is no wifi
- Your log is stored **on your device**, not on anyone's server
- Optional password. If you use one, the log is properly encrypted and nobody —
  including whoever hosts it — can read it
- No account, no subscription, no tracking, nothing to sign up for

---

## Putting it online (about 5 minutes)

You need somewhere to put the files. Netlify's free plan is enough and needs no
card.

1. Go to **https://app.netlify.com/drop**
2. Drag the **`app` folder itself** onto the page — the folder, not the files
   inside it
3. Netlify gives you a web address. **Sign up when it offers**, or the address is
   temporary and you will lose it
4. Open that address on your phone

That is it. There is nothing to configure and no database to set up.

### Put it on your home screen

**iPhone / iPad:** open the address in **Safari** (it must be Safari — iOS does
not let other browsers do this). Tap the Share button, then **Add to Home
Screen**.

**Android:** open it in Chrome, tap the menu, then **Install app** or **Add to
Home screen**.

Do this once while you have a good connection. After that it opens like any
other app and works with no signal.

---

## First run

The first time you open it you will be asked for your boat's details and whether
you want a password.

**Read this part before you choose.**

If you set a password, the log is encrypted. Anyone who finds the web address
sees a locked screen and nothing else. But it also means **nobody can recover it
for you** — not this app, not Netlify, not the person who gave you this. That is
what "encrypted" means, and there is no way to have one without the other.

So the app gives you a **recovery code** and will not let you continue until you
have saved it. It is the only way back in if you forget the password.

> **Print it and put it with the boat's papers.** A photo on the phone that holds
> the log is not a backup — if you lose the phone you lose both.

If you would rather not have a password, choose **No password**. Anyone with the
web address can then read your log, but there is nothing to forget. For a
maintenance log with no personal details in it, that is a perfectly reasonable
choice.

---

## Using it

**Reading** is the normal mode and the app opens that way.

**To edit**, double-click the version badge next to the title — on a touchscreen,
press and hold it. A row of buttons appears. Double-click or long-press again to
go back to reading.

| | |
|---|---|
| **+ New job** | adds a job. Tap it in the list to open it and fill it in |
| **Boat & categories** | your boat's details, and the categories jobs are filed under. Add your own, rename them, pick colours |
| **Undo** | undoes recent changes, back to when you opened the app |
| **Export** | saves your whole log as a file — see Backups |
| **Import** | replaces the log from a file you exported before |

Inside a job, the round button on the left of each line cycles it between a
**note**, a **task to do**, and a **task that is done**.

### What goes in a job

A job is a *job*, not a step. "Replace the raw water pump" is a job; taking the
old one off is a task inside it. A job stays open until the part is back on the
boat and working.

Each line should be a fact about the boat, a decision and why you made it, or
something to do. That is the whole rule, and a log written that way is still
useful in five years.

---

## Backups — please read this one

Your log is stored **on your device**. That is what makes it work offline, and it
means:

- If you lose the device, clear your browser data, or the browser evicts old
  data, **the log goes with it**
- The recovery code gets you past a forgotten password. It does **not** bring
  back a log that was only ever on a phone that fell in the water

So: **press Export every so often** and keep the file somewhere else — a
computer, a cloud drive, an email to yourself. It saves everything: jobs, tasks,
categories, boat details, voyages.

Import puts it all back, on any device.

The exported file is **not encrypted**, so it is readable by anything — which is
what makes it a real backup — but keep it somewhere you would keep the password.

### Moving to a new phone

Export on the old one, open the same web address on the new one, set it up, then
Import. Everything comes across.

---

## Editing the log on a computer, or with an AI

The exported file is plain JSON, and **`DATA-FORMAT.md` in this folder describes
it completely** — deliberately written so that a person, or an AI assistant, can
read and edit it without knowing anything else about the app.

That means you can hand the exported file to an AI, ask it to add or reorganise
entries, and import the result. Nothing about the app is required to understand
the file.

Before importing something that was edited outside the app, it is worth checking
it. If you have Node installed:

```bash
node validate-document.js my-log.json
```

The app runs the same checks on import and will refuse a file that fails them,
telling you which entry is at fault. Nothing is changed until a file passes.

---

## Updates

If you dragged the folder onto Netlify, updating means downloading the newest
version and dragging it again. **Your log is not touched by this** — it lives on
your device, not in the folder you dragged.

If you would rather it update itself, connect Netlify to this repository instead
of dragging a folder: Netlify then redeploys whenever a new version is released,
and every device picks it up next time it opens with signal.

The Updates tab shows which version of the app you are running.

---

## What this app will not do

Worth being straight about, so nothing comes as a surprise:

- **It does not sync between devices.** Edit on the phone and the tablet, and you
  have two different logs. Export and Import is the way to move a log across
- **There is no password reset.** The recovery code is the whole recovery story
- **There is no server, so there is nothing to log in to.** Anyone with the web
  address gets the lock screen, or the log itself if you chose no password

---

## For the technically inclined

Static PWA, no build step, no dependencies, no framework. One HTML file, a
service worker, a manifest and three icons.

Encryption is AES-256-GCM. A random data key encrypts the log; that key is
wrapped twice, once by PBKDF2-HMAC-SHA256 of your password at 310,000 iterations
and once by the recovery code, so changing the password rewraps rather than
re-encrypts. The log lives in IndexedDB, encrypted at rest. The password and the
recovery code are never stored or transmitted.
