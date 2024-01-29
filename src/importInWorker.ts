import type { AnyFunction, Async, Entries, Rejecter, Resolver } from "@samual/lib"
import { cpus } from "os"
import { Worker, parentPort, workerData } from "worker_threads"
import { MessageTag, type ResultMessage, type TaskMessage, type ToChildMessage } from "./internal"

type WorkerData = { ports: (MessagePort | undefined)[], taskCounts: Uint8Array }

const idsToPromiseCallbacks = new Map<number, { resolve: Resolver<any>, reject: Rejecter }>
let idCounter = 0

let importInWorker_: <
	TModule extends object,
	TName extends Extract<Entries<TModule>, [ string, AnyFunction ]>[0]
>(url: URL, name: TName) => Async<TModule[TName] extends AnyFunction ? TModule[TName] : never>

if (parentPort) {
	const { ports, taskCounts } = workerData as WorkerData

	parentPort.on(`message`, async (message: TaskMessage) => handleMessage(message, parentPort!))

	for (const [ index, port ] of ports.entries()) {
		if (port) {
			port.onmessage = ({ data: message }: MessageEvent<ToChildMessage>) => {
				if (message.tag == MessageTag.Task)
					handleMessage(message, port)
				else {
					const { resolve, reject } = idsToPromiseCallbacks.get(message.id)!

					idsToPromiseCallbacks.delete(message.id)
					taskCounts[index]--

					if (message.tag == MessageTag.Return)
						resolve(message.value)
					else
						reject(message.value)
				}
			}
		}
	}

	importInWorker_ = (url, name) => async (...args) => {
		const index = [...taskCounts.keys()]
			.reduce((previous, current) => taskCounts[current]! < taskCounts[previous]! ? current : previous)

		const port = ports[index]

		if (!port)
			return (await import(url.href))[name](...args)

		return new Promise((resolve, reject) => {
			const id = idCounter++

			taskCounts[index]++
			idsToPromiseCallbacks.set(id, { resolve, reject })
			port.postMessage({ tag: MessageTag.Task, id, path: url.href, name, args } satisfies ToChildMessage)
		})
	}
} else {
	const cpuInfos = cpus()
	const messagePorts = cpuInfos.map(() => cpuInfos.map((): MessagePort | undefined => undefined))

	for (let fromIndex = 4; fromIndex--;) {
		for (let toIndex = fromIndex; toIndex--;) {
			const { port1, port2 } = new MessageChannel

			messagePorts[fromIndex]![toIndex] = port1
			messagePorts[toIndex]![fromIndex] = port2
		}
	}

	const thisModuleUrl = new URL(import.meta.url)
	const taskCounts = new Uint8Array(new SharedArrayBuffer(cpuInfos.length))

	const workers = cpuInfos.map((_, index) => {
		const worker = new Worker(thisModuleUrl, {
			workerData: { ports: messagePorts[index]!, taskCounts } satisfies WorkerData,
			transferList: messagePorts[index]!.filter(Boolean) as any
		})

		worker.on(`message`, (message: ResultMessage) => {
			const { resolve, reject } = idsToPromiseCallbacks.get(message.id)!

			idsToPromiseCallbacks.delete(message.id)
			taskCounts[index]--

			if (message.tag == MessageTag.Return)
				resolve(message.value)
			else
				reject(message.value)
		})

		return worker
	})

	importInWorker_ = (url, name) => ((...args) => new Promise((resolve, reject) => {
		const index = [ ...taskCounts.keys() ]
			.reduce((previous, current) => taskCounts[current]! < taskCounts[previous]! ? current : previous)

		const id = idCounter++

		taskCounts[index]++
		idsToPromiseCallbacks.set(id, { resolve, reject })
		workers[index]!.postMessage({ id, path: url.href, name, args } satisfies TaskMessage)
	}))
}

/** @example
  * const heavyFunction = importInWorker<typeof import("./heavyFunction.js"), "heavyFunction">(
  *     new URL("./heavyFunction.js", import.meta.url),
  *     "heavyFunction"
  * ) */
export const importInWorker = importInWorker_

async function handleMessage(message: TaskMessage, port: MessagePort | import("worker_threads").MessagePort) {
	try {
		port.postMessage({
			tag: MessageTag.Return,
			id: message.id,
			value: await (await import(message.path))[message.name](...message.args)
		} satisfies ResultMessage)
	} catch (error) {
		port.postMessage(
			{ tag: MessageTag.Return, id: message.id, value: error as any } satisfies ResultMessage
		)
	}
}
