import type { AnyFunction, Async, Cloneable, Entries, Rejecter, Replace, Resolver } from "@samual/lib"
import { cpus } from "os"
import { Worker, isMainThread, threadId } from "worker_threads"
import { ResultMessage, TaskAcceptAcceptMessage, TaskAcceptMessage, TaskMessage } from "./internal"

// console.debug(`hello from thread ${threadId}`)

type BroadcastChannelT<T> = Replace<BroadcastChannel, {
	postMessage(value: T): void
	addEventListener(type: "message", listener: (event: MessageEvent<T>) => void): void
}>

const taskChannel: BroadcastChannelT<TaskMessage> = new BroadcastChannel(`oz5iuq2d9vnjoifjitqwwbj2`)
const taskAcceptChannel: BroadcastChannelT<TaskAcceptMessage> = new BroadcastChannel(`lu2uxebxuilxcfw940fknu1n`)
const taskAcceptAcceptChannel: BroadcastChannelT<TaskAcceptAcceptMessage> = new BroadcastChannel(`gd4oaynqe9f6ko42sc4wzqig`)
const resolveChannel: BroadcastChannelT<ResultMessage> = new BroadcastChannel(`pzbg9syjsoo1mn8wl1y0wdin`)
const rejectChannel: BroadcastChannelT<ResultMessage> = new BroadcastChannel(`kyrwq81vj30430boo45bqy4x`)

const tasks = new Map<
	number,
	{ resolve: Resolver<any>, reject: Rejecter, data: { path: string, name: string, args: Cloneable[] } | undefined }
>

if (!isMainThread) {
	taskChannel.addEventListener("message", event => {
		taskAcceptChannel.postMessage({
			taskId: event.data.taskId,
			fromThreadId: threadId,
			toThreadId: event.data.fromThreadId
		})
	})
}

taskAcceptChannel.addEventListener("message", event => {
	if (event.data.toThreadId == threadId) {
		const task = tasks.get(event.data.taskId)

		if (task?.data) {
			taskAcceptAcceptChannel.postMessage({
				taskId: event.data.taskId,
				fromThreadId: threadId,
				toThreadId: event.data.fromThreadId,
				path: task.data.path,
				name: task.data.name,
				args: task.data.args
			})

			task.data = undefined
		}
	}
})

taskAcceptAcceptChannel.addEventListener("message", async event => {
	if (event.data.toThreadId == threadId) {
		try {
			resolveChannel.postMessage({
				taskId: event.data.taskId,
				fromThreadId: threadId,
				toThreadId: event.data.fromThreadId,
				value: await (await import(event.data.path))[event.data.name](...event.data.args)
			})
		} catch (error) {
			rejectChannel.postMessage({
				taskId: event.data.taskId,
				fromThreadId: threadId,
				toThreadId: event.data.fromThreadId,
				value: error as any
			})
		}
	}
})

resolveChannel.addEventListener("message", event => {
	if (event.data.toThreadId == threadId) {
		const task = tasks.get(event.data.taskId)!

		tasks.delete(event.data.taskId)
		task.resolve(event.data.value)
	}
})

rejectChannel.addEventListener("message", event => {
	if (event.data.toThreadId == threadId) {
		const task = tasks.get(event.data.taskId)!

		tasks.delete(event.data.taskId)
		task.reject(event.data.value)
	}
})

let idCounter = 0

if (isMainThread) {
	const url = new URL(import.meta.url)

	for (let index = cpus().length; index--;)
		new Worker(url)
}

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

	return new Promise((resolve, reject) => {
		tasks.set(taskId, { resolve, reject, data: { path: url.href, name, args } })
		taskChannel.postMessage({ fromThreadId: threadId, taskId })
	})
}) as Async<TModule[TName] extends AnyFunction ? TModule[TName] : never>
