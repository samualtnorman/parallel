#!/bin/sh
set -ex
rm -rf dist
./rollup.config.js
scripts/emit-declarations.sh || true
scripts/emit-package-json.js
rm dist/internal.d.ts dist/process.d.ts dist/worker.d.ts
cp readme.md license dist
