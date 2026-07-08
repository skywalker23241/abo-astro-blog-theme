# Repository Guidelines

## Project Structure & Module Organization
This is an Astro site. Source code lives in `src/`: routes in `src/pages`, shared UI in `src/components` and `src/layouts`, helpers in `src/lib`, `src/utils`, and `src/plugins`, and global styles in `src/styles`. Blog/content entries belong in `src/content/posts`; use kebab-case filenames and prefix drafts with `_`. Static files and public assets live in `public/`. Build output is written to `dist/` and should not be committed. Root-level automation belongs in `scripts/`. Use the `@/` alias from `tsconfig.json` instead of long relative imports.

## Build, Test, and Development Commands
- `pnpm install` installs dependencies from `pnpm-lock.yaml`.
- `pnpm dev` starts the local Astro development server with HMR.
- `pnpm build` runs `scripts/toggle-proxy.ts` and builds production output to `dist/`.
- `pnpm preview` serves the built site locally, useful before Netlify deploys.
- `pnpm lint` and `pnpm lint:fix` run ESLint across Astro and TypeScript files.
- `pnpm format:check` and `pnpm format` run Prettier with `prettier-plugin-astro`.
- `pnpm new` scaffolds a new post; `pnpm update-theme` runs the theme helper script.

## Coding Style & Naming Conventions
The project uses strict TypeScript via Astro’s strict config, so avoid `any` unless there is a documented reason. Prettier enforces 2-space indentation and single quotes. Use PascalCase for components, camelCase for utilities and functions, and kebab-case for content slugs. Keep lint disables narrow and include a short reason.

## Testing Guidelines
There is no dedicated automated test suite yet. For each change, run at least `pnpm lint` plus either `pnpm dev` or `pnpm preview` and document the checked URL or workflow. For logic-heavy utilities, add focused tests beside the relevant utility in a `__tests__` folder using `*.test.ts` naming when a test runner is introduced.

## Commit & Pull Request Guidelines
Recent history uses short imperative subjects, sometimes with scopes, such as `Update Header.astro` or `perf: frontend performance optimizations`. Keep subjects under 72 characters and explain motivation in the body when needed. PRs should summarize the change, link issues or state `N/A`, list verification commands, and include screenshots or before/after notes for UI and content edits.

## Content & Configuration Tips
Site metadata, feature flags, and theme settings live in `src/config.ts`; mention SEO or feed impacts when editing them. `scripts/toggle-proxy.ts` may rename `src/pages/api/proxy.ts` during builds, so verify the intended `linkCard` and proxy state before release. Keep `netlify.toml` aligned with deployment behavior.
