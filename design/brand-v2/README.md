# ExamBridge Brand V2 Candidate

This directory is a non-active candidate derived from the supplied second-logo reference image. Nothing here is wired into the website, favicon, manifest, or PWA release.

## Master geometry

- Symbol view box: `216 × 180`
- Horizontal logo view box: `1190 × 190`
- Primary: `#253C4B`
- Accent: `#AB9E92`
- Canvas: `#F7F4F1`
- Wordmark: Avenir Next Medium converted to SVG outlines at generation time
- Rendering: flat fills only; no gradients, shadows, filters, masks, or embedded raster images

## Candidate files

- `exambridge-logo-horizontal.svg` — full-colour horizontal lockup
- `exambridge-mark.svg` — full-colour symbol
- `exambridge-logo-monochrome.svg` — single-colour horizontal lockup using `currentColor`
- `exambridge-mark-monochrome.svg` — single-colour symbol using `currentColor`
- `favicon.svg`, `favicon-16x16.png`, `favicon-32x32.png`
- `apple-touch-icon-180x180.png`
- `pwa-icon.svg`, `icon-192x192.png`, `icon-512x512.png`
- `pwa-icon-maskable.svg`, `maskable-icon-512x512.png`
- `brand-v2-preview.svg` — local visual review sheet

## Regeneration

Compile and run the Objective-C generator on macOS:

```sh
CLANG_MODULE_CACHE_PATH=/private/tmp/exambridge-brand-v2-clang-cache \
  clang -fobjc-arc -fblocks -framework AppKit -framework CoreText \
  scripts/generate-brand-v2.m -o /private/tmp/generate-brand-v2

/private/tmp/generate-brand-v2 design/brand-v2
```

Do not copy these files into `public/` until the owner separately approves replacing the active website brand.

## Local review completed

- Master SVGs parsed successfully as XML.
- Production candidates contain vector paths only, with no text, gradients, filters, masks, or embedded images.
- Raster dimensions verified at 16, 32, 180, 192, and 512 pixels.
- The 16-pixel favicon remains recognisable.
- The maskable 512-pixel mark remains inside the PWA safe area.
- Existing website and `public/` brand assets were not changed.
