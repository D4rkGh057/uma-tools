@echo off
pnpm exec esbuild app.tsx --bundle --external:assert --outfile=bundle.js && ^
pnpm exec unassert bundle.js > bundle.2.js
rem ..\node_modules\.bin\esbuild bundle.2.js --minify --outfile=bundle.js && ^
rem del bundle.2.js