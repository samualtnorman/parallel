import type { Cloneable } from "@samual/lib"

export type TaskMessage = { id: number, path: string, name: string, args: Cloneable[] }

export const ChildToMainMessageTag = {
	Return: 0,
	Throw: 1,
	Task: 2
	// TODO Can be expanded to `yield` in the future
} as const

export type ChildToMainMessageTag = typeof ChildToMainMessageTag[keyof typeof ChildToMainMessageTag]
export type ChildToMainMessage =
	{ tag: typeof ChildToMainMessageTag.Return | typeof ChildToMainMessageTag.Throw, id: number, value: Cloneable } |
	({ tag: typeof ChildToMainMessageTag.Task } & TaskMessage)
