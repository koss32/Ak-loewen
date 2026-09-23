# AK-LOEWEN gGmbH website specification

> ## Routing notice — updated 2026-09-23
>
> This specification remains the **baseline source for project facts and requirements**, but its original `codex/site-v1` implementation-routing instructions are historical.
>
> **Do not use `codex/site-v1` for new implementation work.** Always read the live router first: [`../index.md`](../index.md).
>
> The current working implementation is in `release-6/site/`. Use the routing pointer in `index.md` and verify the remote branch HEAD before implementation work. This specification is historical context for facts and requirements; earlier release instructions do not override the current branch's documentation.

## Binding source of truth

This project is exclusively for **AK-LOEWEN gGmbH**. It is not a reusable template or a project for another company.

The historical implementation baseline recorded when v5 was written was:

- repository: `koss32/Ak-loewen`
- documentation/default branch: `Ak-loewen`
- historical implementation branch: `codex/site-v1` — **deprecated for new work**
- historical baseline commit: `d640c22c5f1d98f81925b5e7668fdb0b65da76c4`
- implementation path: `site/`
- historical standalone preview: `concepts/ak-loewen-valset-site-v1.html`

The old `concepts/ak-loewen-valset-konzept-v2.html` is historical material only. Do not repair it, copy from it, or use it as the implementation baseline. The current implementation route must be taken from `index.md` rather than the historical branch reference above.

## Color system

Use the orange shown in the current approved visual file:

- primary AK Löwen orange: `#E85A22`
- light-theme orange: `#C4501E`
- lighter accent: `#FF7A3D`

Do not use `#FE4123` as the project's required brand color. Do not replace the current orange with a different red-orange without explicit approval.

## Required work

Improve the existing approved implementation visually and functionally without replacing its approved visual language:

- preserve the dark AK Löwen system, the orange palette above, the blue/yellow VALSET system, angular cards, two brand entrances and animated boxing gloves;
- improve hero hierarchy and the primary free-trial CTA;
- reduce repetitive card grids through varied information blocks and visual pauses;
- strengthen trainer trust without inventing identities, biographies, achievements or images;
- improve scanning of schedule, prices and the trial form;
- check mobile hero composition, glove placement, headings, CTA readability and horizontal overflow;
- keep confirmed data from the active implementation's `site/src/data.js` authoritative;
- keep four locales and existing accessibility and security behavior.

No new large animation scenes may be added until the visual pass is approved. ScrollCraft and the current glove choreography must not be removed or replaced without explicit approval.

## Delivery protocol

Work in reviewed parts. Before each material decision, ask targeted clarification questions if the answer can change the result. After each part, provide a preview and wait for approval where the specification requires it.

Create a backup branch or tag from the relevant approved baseline before editing when appropriate. Use clear commits and provide a changelog and visual preview. Never publish production without approval.

## Historical release order

The original v5 plan was:

1. Release A: visual and functional improvements, content, locales, navigation, forms, legal pages, responsive behavior and QA.
2. Release B: scroll motion and microinteractions, only after written approval of Release A.

Later releases supersede this document's historical implementation routing. For current status, read `index.md` and the active branch's release documents.

Do not invent schedules, prices, contacts, legal data, trainer facts or VALSET age criteria. Keep unresolved data explicitly pending.

## Existing implementation map

For the current implementation, use the active branch's `site/AI-MAP.md`. Core ownership remains conceptually:

- `site/src/data.js`: confirmed project data
- `site/src/locales.js`: DE/RU/UK/TR translations
- `site/src/render.js`: server-rendered pages
- `site/public/style.css`: visual system
- `site/public/client.js`: interactions and motion
- `site/public/vendor/`: ScrollCraft engine

The website is for AK-LOEWEN gGmbH only. Historical v1/v2 references are context, never an automatic working-source pointer.
