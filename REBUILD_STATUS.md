# Reconstructed connection candidate (not deployed)

Public baseline: `6d01a7d69899651f8d4c468dfe4971ed2c750445` (v0.5.24).
Candidate: v0.5.25, cache generation `work-report-shell-v40`.
This is a new reconstruction, not a recovered byte-identical copy of any lost candidate. All test results must come from this checkout.

## Entry and boundaries

This independent integration branch configures default shared-data startup through `google-entry → app-entry → connection-entry → connected-original-app`. It is NOT deployed. Publication remains gated on actual backend readiness. Explicit `?mode=local` alone reads legacy local storage. All HTTP tests use fake transport; no production API is called by tests.

- `original-app.js` retains the original report, browse/detail/edit/history, settings, summary and output renderers. `app.js` retains the baseline `appReady` entry contract.
- `original-data-adapter.js` validates complete authenticated snapshots, uses explicit commands, verifies durable receipt hashes and expected revision progression, preserves unknown-save guards, and rejects late reads.
- `workspace-client.js` uses a reviewed, explicitly supplied Apps Script endpoint. Tokens remain in memory. Token acquisition, fetch and JSON parsing have bounded waits and identity cancellation.
- `workspace-pending.js` persists only per-UID operation IDs/revisions, with Web Locks and readback. No bank data, token or complete command is persisted. Receipt lookup never sends a new operation. An unknown result remains blocked when no durable receipt can be found; reloading does not invent a new request.
- `browse-record-sync.js` checks only visible browse/edit context, nominally every 27–30 seconds plus network time. Changes require a verified complete snapshot; five-minute deep verification also runs while eligible. Drafts/saves prevent adoption; hidden/other pages do not poll.
- `connection-entry.js` provides an explicit OFF-by-default composition of Firebase identity, reviewed endpoint, pending journal and connected loader. This candidate imports it through app-entry with the reviewed endpoint; synthetic transport tests do not change the published application.
- `connected-original-app.js` waits for data, original UI and required invoice/image preparation before returning. Only the authenticated outer gate activates and reveals the body. Image readiness means validated image bytes and saved-artwork preparation, not every browser image's decode completion.
- `account-seal-store.js` uses `account:<UID>` only. Legacy `current` is not read, copied or deleted. Artwork remains device-local and is persisted only through the original explicit control.
- Company/bank/tax use injected server settings in connected mode. Document-derived unreviewed sections are visibly labelled. Account information must never be embedded in this source or a public sheet.
- Reference output keeps original subtotal behavior: null historical prices remain uncalculable, not zero or current-rate substitutions. Tax/base fees/formal invoice totals are not verified. Reference-output readiness is distinct from source-sheet projection readiness.

## Reproduce

Requires the Node version in package.json and the public baseline Git object (included in a normal full Git bundle).

```sh
npm ci --ignore-scripts
npm run check
npm test
node scripts/build-asset-manifest.mjs /tmp/routenote-candidate-manifest.json
```

The UI-baseline test reconstructs public v0.5.24 files from Git into a disposable temporary directory, mounts the same synthetic dataset, and compares 12 business DOM snapshots. The approved summary total layout is normalized only by category equation values, total and unchanged detail rows; other markup remains compared. All original CSS bytes are retained, with only a clearly marked summary-only addition; invoice.css remains byte-identical. It does not use real accounts, business values or network writes.

The manifest hashes raw asset bytes, including PNGs, and validates the relative-import/service-worker precache graph. Regenerate after every source change. Its audit records candidate-only default cloud configuration; static validation is not production verification.

## Remaining release gates

- Independent review and real backend runtime DTO/command integration.
- Recovered or rebuilt Apps Script authenticated routing, private storage durability, direct-sheet reconciliation and exact projection verification.
- Approved private initialization and settings seed, without new file sharing.
- Explicit selection of the reviewed default connection entry and endpoint, followed by a new manifest and full regression run.
- Production read/write/recovery/permission checks and actual iPhone/PWA acceptance. Current tests are synthetic Node/JSDOM; native top-layer behavior is not fully modeled by JSDOM.

No production data migration, public deployment, external sharing or real account test is performed by these scripts.

## Approved summary presentation exception

Category boxes have boundary plus signs; the total equation uses matching three-column positions without repeated visible category names. Detail rows and all calculations remain unchanged. Synthetic tests cover stored category amounts and disabled current categories without removing historical values. Native responsive checks are prepared in `scripts/check-summary-layout.mjs`, but Chromium could not launch in this execution sandbox (`socket() failed: Operation not permitted`); real rendering remains to be verified.
