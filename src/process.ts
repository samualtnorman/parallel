import { MessageTag, type Message } from "./internal"

process.addListener(`message`, (async ({ args, name, id, path }: Message) => {
	try {
		process.send!({
			tag: MessageTag.Return,
			id,
			value: await (await import(path))[name](...args)
		} satisfies Message)
	} catch (error) {
		process.send!({ tag: MessageTag.Throw, id, value: error as any } satisfies Message)
	}
}) as NodeJS.MessageListener)
