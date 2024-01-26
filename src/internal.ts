import type { Cloneable } from "@samual/lib"

export const MessageTag = {
	Return: 0,
	Throw: 1,
	Task: 2
	// TODO Can be expanded to `yield` in the future
} as const

export type MessageTag = typeof MessageTag[keyof typeof MessageTag]

export type Message =
	{ tag: typeof MessageTag.Return | typeof MessageTag.Throw, id: number, value: Cloneable } |
	{ tag: typeof MessageTag.Task, id: number, path: string, name: string, args: Cloneable[] }
