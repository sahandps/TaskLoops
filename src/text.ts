/** Shorten to `n` characters, ending with an ellipsis when cut. */
export function truncate(s: string, n: number): string {
	if (s.length <= n) return s;
	return s.slice(0, n - 1).replace(/\s+$/, "") + "…";
}
