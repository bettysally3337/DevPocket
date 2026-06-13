# AGENTS.md

## Project Location

- The canonical project is `D:\Code Project\DevPocket`.
- Only modify files inside this directory for DevPocket work.
- Do not create, copy, or maintain a second DevPocket project in OneDrive.

## Stack And Deployment

- Use Vue 3 with Vite and follow the existing project structure and patterns.
- GitHub Pages is deployed through the workflow in `.github/workflows/deploy-pages.yml`.
- Do not switch Pages to "Deploy from a branch" unless the user explicitly requests it.
- Keep the Vite base path set to `/DevPocket/` so assets work at the project Pages URL.
- After code, dependency, or build configuration changes, run `npm run build` and resolve failures before finishing.

## Files And Git

- Write text files as UTF-8 without BOM.
- Do not commit `node_modules`, `dist`, Vite caches, logs, or other generated output.
- Do not commit or push unless the user explicitly requests it.
- Preserve unrelated user changes and integrate remote changes instead of overwriting them.

## UI And Product

- Preserve the existing visual language and Traditional Chinese interface unless the user asks for a redesign or another language.
- Keep browser-heavy libraries and models dynamically loaded so the initial page remains lightweight.
- Clearly explain large downloads, processing time, memory limits, and browser compatibility where relevant.
- Prefer local browser processing and do not upload user files unless a future feature explicitly requires and discloses it.

## Feature Boundaries

- Do not implement YouTube downloading because of platform terms and content licensing concerns.
- Keep PDF-to-Word and Office-to-PDF disabled until a reliable backend document engine is available.
- Browser implementations may use IMG.LY for background removal and FFmpeg WASM for media conversion.
- Keep the current 200 MB media warning unless testing supports a different limit.