# DevPocket

DevPocket is a Vue 3 + Vite browser toolbox designed for GitHub Pages.
live on : https://bettysally3337.github.io/DevPocket/
The whole project is produced by AI.

## Features

- UTF-8 Base64 encode/decode
- URI / URL and URI component encode/decode
- JSON formatting, minification, and validation
- Images merged into PDF
- HEIC to JPG
- WebP to PNG/JPG
- Traditional Chinese and English OCR
- AI background removal with IMG.LY
- MOV/video to MP4 with FFmpeg WASM
- Video clips to GIF with FFmpeg WASM

Files are processed locally. AI models, OCR data, and FFmpeg are loaded only when their tools are used. Large media files can exceed browser memory; the UI recommends files below 200 MB.

PDF to Word and Office to PDF remain backend-dependent because a browser cannot reliably reproduce Office document layout. YouTube downloading is intentionally not provided.

## Development

```bash
npm install
npm run dev
```

Build with `npm run build`. The included GitHub Actions workflow deploys `dist` to GitHub Pages whenever `main` is pushed.
