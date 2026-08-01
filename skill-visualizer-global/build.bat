@echo off
pnpm exec esbuild app.tsx --bundle --external:assert --outfile=bundle.js && ^
pnpm exec unassert bundle.js > bundle.2.js && ^
pnpm exec esbuild bundle.2.js --minify --outfile=bundle.js && ^
del bundle.2.js
