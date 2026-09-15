# Fibu

Your progressive-overload training buddy. A local-first PWA — no accounts, no backend, your data stays on your device (IndexedDB). AI features (daily coach message, chat, voice logging, meal-photo estimates) are optional and run on your own free Gemini key, entered in-app under Settings.

## Stack

- Vite + React + TypeScript + Tailwind v4
- Dexie (IndexedDB) for storage, `dexie-react-hooks` for live queries
- `body-muscles` for the anatomical muscle diagram
- `@zxing/browser` for barcode scanning, Open Food Facts for nutrition lookup (free, keyless)
- Gemini API (`gemini-3.6-flash`) for the AI layer — bring your own free key from [Google AI Studio](https://aistudio.google.com)
- `vite-plugin-pwa` for installability + offline shell

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build   # type-checks, builds, and generates the service worker
npm run lint
```

## Brand

See `brand/brand-bible.html` (or open it locally) for the logo, color tokens, type, and voice guidelines — every value there matches `src/index.css` exactly.
