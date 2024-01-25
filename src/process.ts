import { ChildToMainMessageTag, type ChildToMainMessage, type TaskMessage } from "./internal"

process.addListener(`message`, (async ({ args, name, id, path }: TaskMessage) => {
	try {
		process.send!({
			tag: ChildToMainMessageTag.Return,
			id,
			value: await (await import(path))[name](...args)
		} satisfies ChildToMainMessage)
	} catch (error) {
		process.send!({ tag: ChildToMainMessageTag.Throw, id, value: error as any } satisfies ChildToMainMessage)
	}
}) as NodeJS.MessageListener)
