import { expect } from "@samual/assert"
import type { AnyFunction, Async, PickByValue, Rejecter, Resolver } from "@samual/types"
import { cpus } from "os"
import { Worker, parentPort, workerData } from "worker_threads"
import { MessageTag, type ResultMessage, type TaskMessage, type ToChildMessage } from "./internal"

type WorkerData = { k14nyo0s378girc3yy7an24u: undefined, ports: (MessagePort | undefined)[], taskCounts: Uint32Array }

const isWorkerData = (workerData: unknown): workerData is WorkerData =>
	!!workerData && typeof workerData == `object` && "k14nyo0s378girc3yy7an24u" in workerData

const idsToPromiseCallbacks = new Map<number, { resolve: Resolver<any>, reject: Rejecter }>
let idCounter = 0

let importInWorker_: <TModule extends object>(moduleName: string) =>
	<TName extends string & keyof PickByValue<TModule, AnyFunction>>(name: TName) =>
		Async<TModule[TName] extends AnyFunction ? TModule[TName] : never>

const validateModuleName = (moduleName: string) => {
	if (moduleName.startsWith(`./`))
		throw TypeError(`Cannot use relative imports. Use new URL("./relative-module.js", import.meta.url).href`)
}

if (isWorkerData(workerData)) {
	const { ports, taskCounts } = workerData
	const workerIndex = ports.findIndex(ports => !ports)

	parentPort!.on(`message`, async (message: TaskMessage) => handleTaskMessage(message, parentPort!))

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

	importInWorker_ = moduleName => name => async (...args) => {
		validateModuleName(moduleName)

		const index = [ ...taskCounts.keys() ]
			.reduce((previous, current) => taskCounts[current]! < taskCounts[previous]! ? current : previous)

		if (index == workerIndex)
			// TODO investigate if adding `taskCounts[workerIndex]++` and `taskCounts[workerIndex]--` affects performance
			return (await import(moduleName))[name](...args)

		return new Promise((resolve, reject) => {
			const id = idCounter++

			idsToPromiseCallbacks.set(id, { resolve, reject })
			ports[index]!.postMessage({ tag: MessageTag.Task, id, moduleName, name, args } satisfies ToChildMessage)
		})
	}

	async function handleTaskMessage(message: TaskMessage, port: MessagePort | import("worker_threads").MessagePort) {
		taskCounts[workerIndex]!++

		try {
			port.postMessage({
				tag: MessageTag.Return,
				id: message.id,
				value: await (await import(message.moduleName))[message.name](...message.args)
			} satisfies ResultMessage)
		} catch (error) {
			port.postMessage(
				{ tag: MessageTag.Return, id: message.id, value: error as any } satisfies ResultMessage
			)
		} finally {
			taskCounts[workerIndex]!--
		}
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
	const taskCounts = new Uint32Array(new SharedArrayBuffer(cpuInfos.length * 4))

	let workersCache: Worker[] | undefined

	const getWorkers = () => workersCache ||= cpuInfos.map((_, index) => {
		const worker = new Worker(thisModuleUrl, {
			workerData:
				{ k14nyo0s378girc3yy7an24u: undefined, ports: messagePorts[index]!, taskCounts } satisfies WorkerData,
			transferList: messagePorts[index]!.filter(Boolean) as any
		})

		worker.on(`message`, (message: ResultMessage) => {
			const { resolve, reject } = idsToPromiseCallbacks.get(message.id)!

			idsToPromiseCallbacks.delete(message.id)

			if (!idsToPromiseCallbacks.size) {
				for (const worker of expect(workersCache))
					worker.terminate()

				workersCache = undefined
			}

			if (message.tag == MessageTag.Return)
				resolve(message.value)
			else
				reject(message.value)
		})

		worker.on("error", error => console.error(`Caught`, error))

		return worker
	})

	importInWorker_ = moduleName => name => ((...args) => new Promise((resolve, reject) => {
		validateModuleName(moduleName)

		const index = [ ...taskCounts.keys() ]
			.reduce((previous, current) => taskCounts[current]! < taskCounts[previous]! ? current : previous)

		const id = idCounter++

		idsToPromiseCallbacks.set(id, { resolve, reject })
		getWorkers()[index]!.postMessage({ id, moduleName, name, args } satisfies TaskMessage)
	}))
}

/** @example
  * const heavyFunction =
  *     importInWorker<typeof import("./heavyFunction.js")>(new URL("./heavyFunction.js", import.meta.url).href)("heavyFunction")
  */
export const importInWorker = importInWorker_
