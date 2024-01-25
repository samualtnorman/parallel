import type { AnyFunction, Async, Entries, Rejecter, Resolver } from "@samual/lib"
import { cpus } from "os"
import { Worker, isMainThread } from "worker_threads"
import { ChildToMainMessageTag, type ChildToMainMessage, type TaskMessage } from "./internal"

const WorkerModuleURL = isMainThread ? new URL(`worker.js`, import.meta.url) : undefined
const idsToPromiseCallbacks = isMainThread ? new Map<number, { resolve: Resolver<any>, reject: Rejecter }> : undefined
let idCounter = 0

const taskers = isMainThread && cpus().map(() => {
	const tasker = { worker: new Worker(WorkerModuleURL!), tasks: 0 }

	tasker.worker.on(`message`, (message: ChildToMainMessage) => {
		if (message.tag == ChildToMainMessageTag.Task) {
			// TODO forward task
		} else {
			const { resolve, reject } = idsToPromiseCallbacks!.get(message.id)!

			idsToPromiseCallbacks!.delete(message.id)
			tasker.tasks--

			if (message.tag == ChildToMainMessageTag.Return)
				resolve(message.value)
			else
				reject(message.value)
		}
	})

	return tasker
})

/** @example
  * const { heavyFunction } = importInWorker<typeof import("./heavyFunction.js"), "heavyFunction">(
  *     new URL("./heavyFunction.js", import.meta.url),
  *     "heavyFunction"
  * ) */
export const importInWorker = taskers
	? <
		TModule extends object,
		TName extends Extract<Entries<TModule>, [ string, AnyFunction ]>[0]
	>(url: URL, name: TName) => ((...args: any) => {
		const tasker = taskers.reduce((previous, current) => previous.tasks > current.tasks ? current : previous)
		const id = idCounter++

		tasker.tasks++
		tasker.worker.postMessage({ id, path: url.href, name, args } satisfies TaskMessage)

		return new Promise((resolve, reject) => idsToPromiseCallbacks!.set(id, { resolve, reject }))
	}) as Async<TModule[TName] extends AnyFunction ? TModule[TName] : never>
	: <
		TModule extends object,
		TName extends Extract<Entries<TModule>, [ string, AnyFunction ]>[0]
	>(url: URL, name: TName) => ((...args: any) => {
		// TODO contact parent
	}) as Async<TModule[TName] extends AnyFunction ? TModule[TName] : never>
