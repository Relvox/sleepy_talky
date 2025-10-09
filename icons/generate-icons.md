# PWA Icon Generation

To generate proper PWA icons from the existing speech-bubble.png:

## Required Sizes:
- 72x72 (Android)
- 96x96 (Android)
- 128x128 (Android)
- 144x144 (Android)
- 152x152 (iOS)
- 192x192 (Android, Chrome)
- 384x384 (Android)
- 512x512 (Android, splash screens)

## Using ImageMagick:
```bash
# Install ImageMagick if needed
# Windows: choco install imagemagick
# macOS: brew install imagemagick
# Linux: apt-get install imagemagick

# Generate all sizes
convert speech-bubble.png -resize 72x72 icons/icon-72.png
convert speech-bubble.png -resize 96x96 icons/icon-96.png
convert speech-bubble.png -resize 128x128 icons/icon-128.png
convert speech-bubble.png -resize 144x144 icons/icon-144.png
convert speech-bubble.png -resize 152x152 icons/icon-152.png
convert speech-bubble.png -resize 192x192 icons/icon-192.png
convert speech-bubble.png -resize 384x384 icons/icon-384.png
convert speech-bubble.png -resize 512x512 icons/icon-512.png
```

## Alternative - Online Tool:
Visit https://realfavicongenerator.net/ or https://www.pwabuilder.com/imageGenerator
and upload speech-bubble.png to generate all required sizes.

## Current Setup:
For now, manifest.json references the existing speech-bubble.png as a 512x512 icon.
Generate proper sizes above for production deployment.
