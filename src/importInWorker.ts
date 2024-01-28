import type { AnyFunction, Async, Entries, Rejecter, Resolver } from "@samual/lib"
import { cpus } from "os"
import { Worker, isMainThread, parentPort, threadId, workerData } from "worker_threads"
import { MessageTag, type Message } from "./internal"

const idsToPromiseCallbacks = new Map<number, { resolve: Resolver<any>, reject: Rejecter }>
let idCounter = 0

parentPort?.on(`message`, async (message: Message) => {
	if (message.tag == MessageTag.Task) {
		try {
			parentPort!.postMessage({
				tag: MessageTag.Return,
				id: message.id,
				value: await (await import(message.path))[message.name](...message.args)
			} satisfies Message)
		} catch (error) {
			parentPort!
				.postMessage({ tag: MessageTag.Return, id: message.id, value: error as any } satisfies Message)
		}
	} else {
		const { resolve, reject } = idsToPromiseCallbacks.get(message.id)!

		idsToPromiseCallbacks.delete(message.id)

		if (message.tag == MessageTag.Return)
			resolve(message.value)
		else
			reject(message.value)
	}
})

let taskCounts: Uint8Array
let workers: Worker[] | undefined

if (isMainThread) {
	const cpuInfos = cpus()
	taskCounts = new Uint8Array(new SharedArrayBuffer(cpuInfos.length))
	const messagePorts = cpuInfos.map(() => cpuInfos.map((): MessagePort | undefined => undefined))

	for (let fromIndex = 4; fromIndex--;) {
		for (let toIndex = fromIndex; toIndex--;) {
			const { port1, port2 } = new MessageChannel

			messagePorts[fromIndex]![toIndex] = port1
			messagePorts[toIndex]![fromIndex] = port2
		}
	}

	const thisModuleUrl = new URL(import.meta.url)

	workers = cpuInfos.map((_, index) => {
		const worker = new Worker(thisModuleUrl, {
			workerData: { ports: messagePorts[index], taskCounts },
			transferList: messagePorts[index]!.filter(Boolean) as any
		})

		tasker.worker.on(`message`, (message: Message) => {
			if (message.tag == MessageTag.Task) {
				// let otherWorker = workers![0]!
				// let otherWorkerTaskCount = taskCounts[0]!

				// for (let index = 1; index < )

				const otherTasker = workers!
					.reduce((previous, current, index) => previous.tasks > current.tasks ? current : previous)

				const id = idCounter++

				otherTasker.tasks++
				otherTasker.worker.postMessage({ ...message, id } satisfies Message)

				idsToPromiseCallbacks.set(id, {
					resolve(value) {
						tasker.worker.postMessage({ tag: MessageTag.Return, id: message.id, value } satisfies Message)
					},
					reject(value: any) {
						tasker.worker.postMessage({ tag: MessageTag.Throw, id: message.id, value } satisfies Message)
					}
				})
			} else {
				const { resolve, reject } = idsToPromiseCallbacks.get(message.id)!

				idsToPromiseCallbacks.delete(message.id)
				tasker.tasks--

				if (message.tag == MessageTag.Return)
					resolve(message.value)
				else
					reject(message.value)
			}
		})

		return tasker
	})
} else {
	taskCounts = workerData.taskCounts
	console.log(threadId, workerData)
}

/** @example
  * const heavyFunction = importInWorker<typeof import("./heavyFunction.js"), "heavyFunction">(
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

		return new Promise((resolve, reject) => {
			idsToPromiseCallbacks.set(id, { resolve, reject })
			tasker.worker.postMessage({ tag: MessageTag.Task, id, path: url.href, name, args } satisfies Message)
		})
	}) as Async<TModule[TName] extends AnyFunction ? TModule[TName] : never>
	: <
		TModule extends object,
		TName extends Extract<Entries<TModule>, [ string, AnyFunction ]>[0]
	>(url: URL, name: TName) => ((...args: any) => {
		const id = idCounter++

		return new Promise((resolve, reject) => {
			idsToPromiseCallbacks.set(id, { resolve, reject })
			parentPort!.postMessage({ tag: MessageTag.Task, id, args, name, path: url.href } satisfies Message)
		})
	}) as Async<TModule[TName] extends AnyFunction ? TModule[TName] : never>
