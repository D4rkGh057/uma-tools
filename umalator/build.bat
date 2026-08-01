@echo off
pnpm exec esbuild app.tsx --bundle --external:*.ttf --external:assert --define:CC_GLOBAL=false --outfile=bundle.js && ^
pnpm exec unassert bundle.js > bundle.2.js && ^
pnpm exec esbuild bundle.2.js --pure:console.assert --minify --outfile=bundle.js && ^
del bundle.2.js
