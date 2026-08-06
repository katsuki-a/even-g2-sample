# Repository Guidelines

## Project Structure & Module Organization

- `index.html`: phone-side interface and application entry point.
- `src/main.ts`: UI events, Even Hub bridge setup, and image transmission.
- `src/image.ts`: resizing, monochrome conversion, preview generation, and 1-bit BMP encoding.
- `src/styles.css`: responsive application styling.
- `vite.config.ts` and `tsconfig.json`: development server, build, and strict TypeScript settings.
- `dist/`: generated production output; do not edit or commit it.

There is no test directory yet. Put future tests beside their modules as `src/*.test.ts`.

## Build, Test, and Development Commands

- `npm install`: install the locked dependency versions.
- `npm run dev`: start Vite on `http://localhost:5173` for phone or browser development.
- `npm run build`: run strict TypeScript checks, then create the production bundle in `dist/`.
- `npm test`: validate the fitness harness and canonical story graph.
- `npm run fitness`: evaluate the active loop-engineering phase from `harness/config.json`.
- `npm run loop:check`: run tests, active-phase fitness gates, and the production build.
- `npm run preview`: serve the production bundle locally on port 4173.
- `npm run simulator -- "http://localhost:5173/?simulator=true"`: open the Even Hub simulator against the development app.
- `npm run qr`: generate the QR code used to load the app through Even Hub on a phone.

## Coding Style & Naming Conventions

Use TypeScript with two-space indentation, single quotes, trailing commas in multiline objects, and no semicolons, matching the existing source. Keep strict typing enabled; avoid `any` and non-null assertions unless the DOM or SDK contract makes them safe. Use `camelCase` for functions and variables, `PascalCase` for types, and `UPPER_SNAKE_CASE` for shared constants. Keep image-processing logic independent from DOM and bridge code where practical.

No formatter or linter is configured. Treat `npm run build` as the required static check.

## Loop Engineering

- Treat `docs/` as the source of truth for intent and acceptance criteria, and `content/story.json` as the source of truth for runtime dialogue and transitions.
- Work from the lowest failing hard gate or fitness section. Change one dimension per iteration.
- Never lower `harness/config.json`'s `activePhase` to make a regression pass.
- Record simulator and hardware evidence in `harness/evidence.json`; do not mark checks passed without observing them.
- Run `npm run loop:check` before handing off any iteration. Use the implementation or release variants when evaluating the next phase.
- Use `docs/iterations/TEMPLATE.md` for non-trivial iterations and preserve before/after scores.

## Testing Guidelines

Automated tests are not yet configured for the product runtime. Every change must pass `npm run loop:check`. For UI or image changes, manually verify file selection, the 200 × 100 preview, threshold adjustment, inversion, and send-button state while the Hardware Lab remains in place. For SDK changes, test with the simulator and note whether G2 hardware was also tested. Add focused tests for BMP headers, dimensions, and pixel packing when introducing a product test runner.

## Commit & Pull Request Guidelines

Follow the existing Conventional Commit style, for example `feat: add dithering option` or `fix: preserve transparent backgrounds`. Keep commits focused. Pull requests should explain the user-visible change, list validation commands and simulator/device results, link relevant issues, and include screenshots for UI updates. Never commit credentials, local network addresses, `node_modules/`, `dist/`, or `.ehpk` packages.
