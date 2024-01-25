#!/bin/sh
set -ex
rm -rf dist
./rollup.config.js
scripts/emit-declarations.sh
scripts/emit-package-json.js
rm dist/{internal,process,worker}.d.ts
cp readme.md license dist
