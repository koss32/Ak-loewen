# AK LÖWEN release history

## Release 4 — WIP / Preview — 2026-09-16

Release 4 continues the same AK LÖWEN application and focuses on the landing: contact/legal separation, brand presence of AK Löwen and VALSET, and the Telegram entry point.

- Standort block next to `Werwolf 8, 42651 Solingen` now shows only the training address, the map action and a link to the Impressum; the legal identity stays on the Impressum page.
- Both contact cards carry their own brand mark (AK Löwen logo, original VALSET image).
- Added an AK Löwen + VALSET union composition with a scroll-driven convergence animation, static default state and `prefers-reduced-motion` fallback.
- VALSET artwork is shown uncropped with proper inner spacing; the original `/assets/valset.jpg` is unchanged.
- Replaced the wide Telegram booking card with a compact Telegram button that expands its localized label on hover/focus and stays expanded on touch devices.
- Reworked the Sambo & MMA description: short, self-defense focused, no historical background, DE/RU/UK/TR.
- Added regression tests for all landing changes.

See `docs/releases/RELEASE-4.md`.

## Release 3 — WIP / Preview — 2026-09-15

Release 3 is one AK LÖWEN application release. It keeps the Release 2 landing and adds/finishes the Telegram integration connected to its booking flow.

- Added native Telegram booking flow with DE/RU/UK/TR support.
- Added button navigation, FAQ, booking/status/staff flows, Redis/outbox persistence and protected webhook/worker endpoints.
- Published Telegram Privacy notice on Preview.
- Added trainer-group membership validation support.
- Final Preview activation, scheduler binding and end-to-end verification remain incomplete.

See `docs/releases/RELEASE-3.md`.

## Release 2 — approved — 2026-09-14

Approved AK LÖWEN landing baseline.

See `docs/releases/RELEASE-2.md`.

## Historical material

Older concepts, Release A material and previous agent notes are kept only in `archive/` and Git history. They are not active releases.
