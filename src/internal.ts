import type { Cloneable } from "@samual/lib"

export type TaskMessage = { id: number, path: string, name: string, args: Cloneable[] }

export const MessageTag = {
	Task: 0,
	Return: 1,
	Throw: 2
	// TODO Can be expanded to `yield` in the future
} as const

export type MessageTag = typeof MessageTag[keyof typeof MessageTag]

export type ResultMessage =
	{ tag: typeof MessageTag.Return | typeof MessageTag.Throw, id: number, value: Cloneable }

export type ToChildMessage = ResultMessage | (TaskMessage & { tag: typeof MessageTag.Task })
