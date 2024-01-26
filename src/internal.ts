import type { Cloneable } from "@samual/lib"

export const MessageTag = {
	Task: 0,
	TaskAccept: 1,
	TaskAcceptAccept: 2,
	Return: 3,
	Throw: 4
} as const

export type MessageTag = typeof MessageTag[keyof typeof MessageTag]

export type Message =
	| { tag: typeof MessageTag.Task, taskId: number, fromThreadId: number }
	| { tag: typeof MessageTag.TaskAccept, taskId: number, fromThreadId: number, toThreadId: number }
	| {
		tag: typeof MessageTag.TaskAcceptAccept
		taskId: number
		fromThreadId: number
		toThreadId: number
		path: string
		name: string
		args: Cloneable[]
	}
	| {
		tag: typeof MessageTag.Return | typeof MessageTag.Throw
		taskId: number
		fromThreadId: number
		toThreadId: number
		value: Cloneable
	}
