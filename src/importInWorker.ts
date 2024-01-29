import type { AnyFunction, Async, Cloneable, Entries, Rejecter, Resolver } from "@samual/lib"
import { cpus } from "os"
import { Worker, isMainThread, parentPort, threadId } from "worker_threads"
import { MessageTag, type Message } from "./internal"

const broadcastChannel = new BroadcastChannel(`oz5iuq2d9vnjoifjitqwwbj2`)

const tasks = new Map<
	number,
	{ resolve: Resolver<any>, reject: Rejecter, data: { path: string, name: string, args: Cloneable[] } | undefined }
>

broadcastChannel.addEventListener("message", async event => {
	const message: Message = event.data

	if (message.tag == MessageTag.Task) {
		if (!isMainThread) {
			broadcastChannel.postMessage({
				tag: MessageTag.TaskAccept,
				taskId: message.taskId,
				fromThreadId: threadId,
				toThreadId: message.fromThreadId
			} satisfies Message)
		}
	} else if (message.tag == MessageTag.TaskAccept) {
		if (message.toThreadId == threadId) {
			const task = tasks.get(message.taskId)

			if (task?.data) {
				broadcastChannel.postMessage({
					tag: MessageTag.TaskAcceptAccept,
					taskId: message.taskId,
					fromThreadId: threadId,
					toThreadId: message.fromThreadId,
					path: task.data.path,
					name: task.data.name,
					args: task.data.args
				} satisfies Message)

				task.data = undefined
			}
		}
	} else if (message.tag == MessageTag.TaskAcceptAccept) {
		if (message.toThreadId == threadId) {
			try {
				broadcastChannel.postMessage({
					tag: MessageTag.Return,
					taskId: message.taskId,
					fromThreadId: threadId,
					toThreadId: message.fromThreadId,
					value: await (await import(message.path))[message.name](...message.args)
				} satisfies Message)
			} catch (error) {
				broadcastChannel.postMessage({
					tag: MessageTag.Throw,
					taskId: message.taskId,
					fromThreadId: threadId,
					toThreadId: message.fromThreadId,
					value: error as any
				} satisfies Message)
			}
		}
	} else if (message.tag == MessageTag.Return) {
		if (message.toThreadId == threadId) {
			const task = tasks.get(message.taskId)!

			tasks.delete(message.taskId)
			task.resolve(message.value)
		}
	} else if (message.tag == MessageTag.Throw) {
		if (message.toThreadId == threadId) {
			const task = tasks.get(message.taskId)!

			tasks.delete(message.taskId)
			task.reject(message.value)
		}
	}
})

parentPort?.postMessage(undefined)

let idCounter = 0

const url = new URL(import.meta.url)
let anyOnlinePromise: Promise<unknown>

if (isMainThread)
	anyOnlinePromise = Promise.any(cpus().map(() => new Promise(resolve => new Worker(url).on("message", resolve))))

/** @example
  * const heavyFunction = importInWorker<typeof import("./heavyFunction.js"), "heavyFunction">(
  *     new URL("./heavyFunction.js", import.meta.url),
  *     "heavyFunction"
  * ) */
export const importInWorker = <
	TModule extends object,
	TName extends Extract<Entries<TModule>, [ string, AnyFunction ]>[0]
>(url: URL, name: TName) => ((...args: any) => {
	const taskId = idCounter++

	return new Promise(async (resolve, reject) => {
		tasks.set(taskId, { resolve, reject, data: { path: url.href, name, args } })

		if (anyOnlinePromise)
			await anyOnlinePromise

		broadcastChannel.postMessage({ tag: MessageTag.Task, fromThreadId: threadId, taskId } satisfies Message)
	})
}) as Async<TModule[TName] extends AnyFunction ? TModule[TName] : never>
