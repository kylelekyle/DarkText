# DarkText — Word-style track changes smoke test

Run this **after** automated tests pass and you have a dev build with track changes enabled.

**Setup for every section**
- Open a test library (or create `Smoke Test Library`)
- Use a chapter named `Track Changes Smoke Test`
- Start each section from a **fresh duplicate** of the baseline paragraph unless noted
- **Turn Track Changes ON** (Review menu) before editing
- **Show edits** enabled in the editor
- Record: Pass / Fail / Notes

**Baseline chapter content** (paste into a new chapter, save, duplicate as needed):

```text
Paragraph one has plain text for typing tests.

Paragraph two has bold and italic for mark tests.

| Cell A1 | Cell B1 |
| Cell A2 | Cell B2 |
```

---

## 1. Basic typing & deletion

| # | Steps | Expected | Pass? | Notes |
|---|--------|----------|-------|-------|
| 1.1 | Empty paragraph, type `hello` | Green/insertion styling on `hello` | | |
| 1.2 | Continue typing ` world` in same paragraph | Insertion extends; reads `hello world` | | |
| 1.3 | Backspace delete ` world` (one word) | ` world` shows as strikethrough deletion; `hello` unchanged | | |
| 1.4 | Backspace delete `hello` | `hello` becomes strikethrough; paragraph not empty of marks | | |
| 1.5 | Undo (Ctrl+Z) twice | Text restores to `hello world` without duplicate characters | | |
| 1.6 | Redo (Ctrl+Y) twice | Deletions return; no duplicated `hellohello` | | |
| 1.7 | Select all (Ctrl+A) → Delete | All body text struck through; nothing silently vanished | | |
| 1.8 | Undo select-all delete | Full baseline content restored exactly | | |

---

## 2. Selection delete & replace

| # | Steps | Expected | Pass? | Notes |
|---|--------|----------|-------|-------|
| 2.1 | Select `plain text` in paragraph one → Delete | Only that phrase struck through | | |
| 2.2 | Place cursor after `Paragraph` → type `X` | Insertion mark on `X` only | | |
| 2.3 | Select `bold` (in para two) → type `strong` | `bold` deletion, `strong` insertion | | |
| 2.4 | Find/Replace: find `Cell A1`, replace with `Cell X1` (single) | One deletion + one insertion; table intact | | |
| 2.5 | Find/Replace: Replace all `Cell` → `Slot` | Each match tracked; table still renders | | |

---

## 3. Paste & cut

| # | Steps | Expected | Pass? | Notes |
|---|--------|----------|-------|-------|
| 3.1 | Copy `Paragraph one` from same doc; paste at end of para two | Pasted text has insertion marks | | |
| 3.2 | Cut a tracked insertion (select inserted text → Cut) | Text removed or marked deleted per Word-like rules; no orphan half-marks | | |
| 3.3 | Paste plain text from Notepad (`External paste line`) | Insertion mark on pasted line | | |
| 3.4 | Paste formatted text from Word/web if available | No crash; content appears; tracking reasonable (note quirks) | | |

---

## 4. Accept & reject (Review panel)

Use paragraph one with mixed insertion + deletion from section 2.

| # | Steps | Expected | Pass? | Notes |
|---|--------|----------|-------|-------|
| 4.1 | Review panel lists pending changes | Count matches visible marks | | |
| 4.2 | Accept one **insertion** | Mark removed; text remains | | |
| 4.3 | Reject one **insertion** | Inserted text removed | | |
| 4.4 | Accept one **deletion** | Struck text removed from document | | |
| 4.5 | Reject one **deletion** | Strikethrough removed; text normal again | | |
| 4.6 | Accept all | No pending changes; prose reads clean | | |
| 4.7 | **Fresh chapter** with changes → Reject all | Document restored to pre-change wording | | |

---

## 5. Save, reload, export

| # | Steps | Expected | Pass? | Notes |
|---|--------|----------|-------|-------|
| 5.1 | With pending changes, wait for autosave (or switch chapter and back) | Marks still present; text not duplicated | | |
| 5.2 | Close library → reopen → open same chapter | Same visible marks; no extra strikethrough copies | | |
| 5.3 | Accept all → save → reload | No `dt-insertion` / `dt-deletion` in text; reads normal | | |
| 5.4 | Export chapter to DOCX with pending changes | Opens in Word; insertions/deletions visible as revisions | | |
| 5.5 | Compile manuscript with tracked chapter | No crash; content present | | |

---

## 6. Tables

| # | Steps | Expected | Pass? | Notes |
|---|--------|----------|-------|-------|
| 6.1 | Click in Cell A1 → type ` edit` | Insertion in cell only | | |
| 6.2 | Select `Cell B1` inside cell → Delete | Deletion mark in cell; table structure intact | | |
| 6.3 | Tab between cells while tracking on | No crash; cursor moves | | |
| 6.4 | Delete all text in a cell | Cell empty or deletion marks; row/col count unchanged | | |
| 6.5 | Undo/redo table edit | No duplicated cell text | | |

---

## 7. Comments + track changes together

| # | Steps | Expected | Pass? | Notes |
|---|--------|----------|-------|-------|
| 7.1 | Select text → Add comment (tracking on) | Comment thread + text still editable | | |
| 7.2 | Delete part of commented text | Comment anchor behaves reasonably (note if broken) | | |
| 7.3 | Insert text inside comment span | Both comment and insertion marks coexist | | |
| 7.4 | Resolve comment | Comment UI clears; tracked changes unaffected | | |

---

## 8. Mode & toggle

| # | Steps | Expected | Pass? | Notes |
|---|--------|----------|-------|-------|
| 8.1 | Tracking **off** → type and delete | No new marks | | |
| 8.2 | Tracking **on** again | New edits tracked; old marks preserved | | |
| 8.3 | Switch Author ↔ Review mode | Marks display correctly per mode | | |
| 8.4 | Toggle **Show edits** off/on | Deletions hidden/shown; no data loss | | |

---

## 9. Stress & regression

| # | Steps | Expected | Pass? | Notes |
|---|--------|----------|-------|-------|
| 9.1 | 20 random chars typed fast | Single readable insertion; no doubled chars | | |
| 9.2 | Hold backspace 2 seconds | One deletion region, not stacked duplicates per char | | |
| 9.3 | 10 undo/redo cycles on one edit | Ends in sensible state | | |
| 9.4 | Scroll while editing tracked paragraph | No visual glitches | | |
| 9.5 | Split view (if enabled): edit both panes | Tracking only on active editor; no cross-corruption | | |

---

## 10. Failure criteria (stop ship if any occur)

- [ ] Visible text duplicated in the chapter (`the the`, whole paragraph twice)
- [ ] Text missing with no deletion mark
- [ ] Chapter won't open or editor freezes after edit
- [ ] Save/reload changes the story wording without accept/reject
- [ ] Table structure breaks (columns/rows vanish)
- [ ] Accept/reject leaves document in worse state than before

---

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Manual smoke test | | | Pass / Fail |
| Automated tests (`npm run test:unit`) | | | Pass / Fail |
| Known issues deferred | | | (list) |

**Release bar:** Section 10 empty, sections 1–5 all pass, section 6 passes or tables documented as “tracking off in tables” for v0.1.