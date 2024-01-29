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
	const workerIndex = ports.findIndex(ports => !ports)

	parentPort.on(`message`, async (message: TaskMessage) => handleTaskMessage(message, parentPort!))

	for (const port of ports) {
		if (port) {
			port.onmessage = ({ data: message }: MessageEvent<ToChildMessage>) => {
				if (message.tag == MessageTag.Task)
					handleTaskMessage(message, port)
				else {
					const { resolve, reject } = idsToPromiseCallbacks.get(message.id)!

					idsToPromiseCallbacks.delete(message.id)

					if (message.tag == MessageTag.Return)
						resolve(message.value)
					else
						reject(message.value)
				}
			}
		}
	}

	importInWorker_ = (url, name) => async (...args) => {
		const index = [ ...taskCounts.keys() ]
			.reduce((previous, current) => taskCounts[current]! < taskCounts[previous]! ? current : previous)

		if (index == workerIndex)
			// TODO investigate if adding `taskCounts[workerIndex]++` and `taskCounts[workerIndex]--` affects performance
			return (await import(url.href))[name](...args)

		return new Promise((resolve, reject) => {
			const id = idCounter++

			idsToPromiseCallbacks.set(id, { resolve, reject })
			ports[index]!.postMessage({ tag: MessageTag.Task, id, path: url.href, name, args } satisfies ToChildMessage)
		})
	}

	async function handleTaskMessage(message: TaskMessage, port: MessagePort | import("worker_threads").MessagePort) {
		taskCounts[workerIndex]++

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

		taskCounts[workerIndex]--
	}
} else {
	const cpuInfos = cpus()
	const messagePorts = cpuInfos.map(() => cpuInfos.map((): MessagePort | undefined => undefined))

	for (let fromIndex = cpuInfos.length; fromIndex--;) {
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
