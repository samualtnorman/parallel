import type { AnyFunction, Async, Entries, Rejecter, Resolver } from "@samual/lib"
import { fork } from "child_process"
import { cpus } from "os"
import { fileURLToPath } from "url"
import { MessageTag, type Message } from "./internal"

const ProcessModulePath = fileURLToPath(new URL(`process.js`, import.meta.url))
const idsToPromiseCallbacks = new Map<number, { resolve: Resolver<any>, reject: Rejecter }>
let idCounter = 0

const taskers = cpus().map(() => {
	const tasker = { process: fork(ProcessModulePath, { serialization: `advanced` }), tasks: 0 }

	tasker.process.on(`message`, ({ tag: kind, id, value }: Message) => {
		const { resolve, reject } = idsToPromiseCallbacks.get(id)!

		idsToPromiseCallbacks.delete(id)
		tasker.tasks--

		if (kind == MessageTag.Return)
			resolve(value)
		else
			reject(value)
	})

	return tasker
})

/** @example
  * const heavyFunction = importInProcess<typeof import("./heavyFunction.js"), "heavyFunction">(
  *     new URL("./heavyFunction.js", import.meta.url),
  *     "heavyFunction"
  * ) */
export const importInProcess = <
	TModule extends object,
	TName extends Extract<Entries<TModule>, [ string, AnyFunction ]>[0]
>(url: URL, name: TName) => ((...args: any) => {
	const tasker = taskers.reduce((previous, current) => previous.tasks > current.tasks ? current : previous)
	const id = idCounter++

	tasker.tasks++
	tasker.process.send({ id, path: url.href, name, args } satisfies Message)

	return new Promise((resolve, reject) => idsToPromiseCallbacks.set(id, { resolve, reject }))
}) as Async<TModule[TName] extends AnyFunction ? TModule[TName] : never>
