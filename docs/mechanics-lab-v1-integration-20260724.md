# ExamBridge Mechanics Lab V1 integration report

Date: 2026-07-24
Status: local integration complete; not pushed or deployed

## Provenance

- Source repository: `/Users/yuzhou/Documents/Codex/2026-07-16/exambridge-mechanics-lab`
- Source commit: `340bdedfe343affc3428b8d285cadd5382b71a96`
- ExamBridge base: `github/production` at `d131eb4383714e4ec8a52e2f2b0682c41fe3b1e7`
- Integration branch: `feature/mechanics-lab-v1-integration-20260724`

The integration preserves the V1 scene schema and deterministic solver. It does
not add an AI inference path and does not store or publish official PDF files.

## Integrated functionality

- Versioned scene and solution schema, validation, migration entry point and
  versioned local browser storage.
- Deterministic topology, force, friction, constraint and linear-system solver.
- Interactive 2D SVG editor with objects, surfaces, pulleys, ropes, rods,
  supports and applied forces.
- Free-body diagrams, equations, validation results and Chinese explanations.
- Motion playback driven by solved constant-acceleration results, with
  `prefers-reduced-motion` fallback.
- Four starter scenes and all 35 source gold-case fixtures.
- JSON import/export, SVG and PNG export, analysis-text copy, print, save/load
  and reset.
- Lazy route at `/#/mechanics-lab`, global navigation entry and Teaching Tools
  hub card.
- Host theme adaptation, desktop layout and mobile bottom property drawer.

## Verification

| Gate | Result |
|---|---|
| ExamBridge `check` | Passed |
| Existing unit tests | 1,371 passed |
| Mechanics unit/gold/SSR tests | 249 passed |
| Mechanics deterministic coverage | 98.70% statements, 91.02% branches, 100% functions, 99.30% lines |
| Editor Playwright scenarios | 16 passed in Chromium |
| Cross-browser route | Firefox and WebKit passed |
| Responsive overflow | 320, 360, 390, 768 and 1024 px passed |
| Route accessibility | Desktop Chromium and mobile 390 passed |
| Static build | Passed; route chunk 164.11 kB / 51.01 kB gzip |
| Repository secret scan | Passed; 943 tracked files checked |
| Production dependency audit | Moderate-or-higher gate passed; one pre-existing low-risk optional `jspdf > dompurify` advisory remains |
| Tracked PDF files | 0 |

React/SVG interaction components are verified with three SSR render assertions,
the 16-scenario editor suite and route accessibility checks. The separate
coverage gate intentionally instruments deterministic TypeScript modules rather
than treating browser-only TSX event handlers as unexecuted Node code.

The final route accessibility run found one 12 px helper label at 4.34:1
contrast. It was corrected to approximately 4.95:1 and the desktop/mobile route
checks then passed.

## V1 boundaries retained

- 2D point-mass mechanics only.
- No springs, collisions, air resistance, 3D mechanics or complex compound
  pulley networks.
- Free unsupported horizontal motion and several advanced pulley arrangements
  return an explicit `unsupported` or `input-required` status rather than an
  invented result.
- Animation does not automatically follow objects that move outside the
  viewport.
- There is no rubber-band selection; multiple implicit surfaces can overlap
  visually.

## Release note

This branch is intentionally local. Pushing to GitHub, opening or merging a pull
request, and deploying to production require separate user authorization.
