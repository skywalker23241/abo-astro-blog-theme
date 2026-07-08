# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal blog built with **Astro 5** (SSR via Netlify adapter), using MDX for content, React for interactive components, and deployed to **Netlify**. The site is in Chinese (zh_CN) with KaTeX math support.

## Commands

- `pnpm dev` — dev server with HMR
- `pnpm build` — production build (runs `scripts/toggle-proxy.ts` prebuild, then `astro build` to `dist/`)
- `pnpm preview` — serve built output locally
- `pnpm lint` / `pnpm lint:fix` — ESLint
- `pnpm format:check` / `pnpm format` — Prettier
- `pnpm new` — scaffold a new blog post
- No test suite exists; verify changes with `pnpm dev` + `pnpm lint`

## Architecture

- **`src/config.ts`** — central site config: metadata, feature flags (e.g. `linkCard`), theme settings. Type-checked via `src/types/`.
- **`src/content/posts/`** — MD/MDX blog posts. Kebab-case filenames; prefix `_` for drafts. Schema in `src/content.config.ts`.
- **`src/pages/`** — Astro file-based routing. Includes `[...slug].astro` (dynamic post pages), RSS/Atom feeds, API routes under `pages/api/`.
- **`src/layouts/`** — page layout wrappers.
- **`src/components/`** — Astro and React UI components.
- **`src/plugins/`** — custom remark/rehype plugins (reading time, TOC, image processing, copy-code buttons, embedded media).
- **`src/lib/`, `src/utils/`** — shared helpers. `src/api/` has server-side logic (Gemini AI summary widget).
- **`src/styles/`** — global CSS.
- **`scripts/`** — `toggle-proxy.ts` (manages `linkCard` proxy route for build), `new-post.ts`, `update-theme.ts`.

## Key Details

- **`@/` path alias** maps to `src/` (configured in `tsconfig.json` and `vite.resolve.alias`).
- **Strict TypeScript** — extends `astro/tsconfigs/strict`. Avoid `any`.
- **Prettier**: 2-space indent, single quotes, with `prettier-plugin-astro`.
- **`scripts/toggle-proxy.ts`** runs automatically before `pnpm build` — it may rename `src/pages/api/proxy.ts` based on `linkCard` config. Keep `netlify.toml` in sync with deployment expectations.
- **Netlify config** is in `netlify.toml` at repo root.
