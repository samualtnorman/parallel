#!node_modules/.bin/rollup --config
import babelPresetEnv from "@babel/preset-env"
import babelPresetTypescript from "@babel/preset-typescript"
import { babel } from "@rollup/plugin-babel"
import { nodeResolve } from "@rollup/plugin-node-resolve"
import terser from "@rollup/plugin-terser"
import { findFiles } from "@samual/lib/findFiles"
import { cpus } from "os"
import packageJson from "./package.json" assert { type: "json" }

/** @typedef {import("rollup").RollupOptions} RollupOptions */
/** @typedef {import("@babel/preset-env").Options} BabelPresetEnvOptions */

const SOURCE_FOLDER = "src"

/** @type {RollupOptions} */ export default {
	external: Object.keys(packageJson.dependencies).map(name => new RegExp(`^${name}(?:$|/)`)),
	input: Object.fromEntries(
		(await findFiles(SOURCE_FOLDER)).filter(path => path.endsWith(".ts") && !path.endsWith(".d.ts"))
			.map(path => [ path.slice(SOURCE_FOLDER.length + 1, -3), path ])
	),
	output: { dir: "dist" },
	plugins: [
		nodeResolve({ extensions: [ ".ts" ] }),
		babel({
			babelHelpers: "bundled",
			extensions: [ ".ts" ],
			presets: [
				[ babelPresetEnv, /** @satisfies {BabelPresetEnvOptions} */ ({ targets: { node: "18.19" } }) ],
				babelPresetTypescript
			]
		}),
		terser({ keep_fnames: true, compress: { passes: Infinity }, maxWorkers: Math.floor(cpus().length / 2) })
	],
	strictDeprecations: true,
	treeshake: { moduleSideEffects: false }
}
