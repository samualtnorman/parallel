import { importInWorker } from "../importInWorker"
import { isMainThread } from "worker_threads"

const asyncFibonacci = importInWorker<typeof import("./fibonacci.js"), "fibonacci">(
	new URL("./fibonacci.js", import.meta.url),
	"fibonacci"
)

export async function fibonacci(n: number): Promise<number> {
	// console.log(`${threadId} fibonacci(${n})`)

	if (n < 2)
		return n

	const [ a, b ] = await Promise.all([ asyncFibonacci(n - 1), asyncFibonacci(n - 2) ])

	return a + b
}

if (isMainThread) {
	console.time()
	const answer = await fibonacci(26)
	console.timeEnd()
	console.log(answer)
	process.exit()
}
