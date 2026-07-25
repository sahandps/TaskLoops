/** Shorten to `n` characters, ending with an ellipsis when cut. */
export function truncate(s: string, n: number): string {
	return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}
