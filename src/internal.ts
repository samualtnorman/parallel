import type { Cloneable } from "@samual/lib"

export type TaskMessage = { taskId: number, fromThreadId: number }
export type TaskAcceptMessage = { taskId: number, fromThreadId: number, toThreadId: number }

export type TaskAcceptAcceptMessage =
	{ taskId: number, fromThreadId: number, toThreadId: number, path: string, name: string, args: Cloneable[] }

export type ResultMessage = { taskId: number, fromThreadId: number, toThreadId: number, value: Cloneable }
