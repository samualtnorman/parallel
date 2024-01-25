import { parentPort } from "worker_threads"
import { ChildToMainMessageTag, type ChildToMainMessage, type TaskMessage } from "./internal"

parentPort!.on(`message`, async ({ args, name, id, path }: TaskMessage) => {
	try {
		parentPort!.postMessage({
			tag: ChildToMainMessageTag.Return,
			id,
			value: await (await import(path))[name](...args)
		} satisfies ChildToMainMessage)
	} catch (error) {
		parentPort!
			.postMessage({ tag: ChildToMainMessageTag.Return, id, value: error as any } satisfies ChildToMainMessage)
	}
})
