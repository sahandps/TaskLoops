/** A wikilink being typed at the caret, without interpreting the rest of the task. */
export interface LinkQuery {
	start: number;
	end: number;
	query: string;
}
export function noteLinkQuery(value: string, caret: number): LinkQuery | null {
	const before = value.slice(0, caret);
	const start = before.lastIndexOf("[[");
	if (start < 0) return null;
	const query = before.slice(start + 2);
	if (query.includes("[") || query.includes("]") || /[\r\n|#]/.test(query)) return null;
	return { start, end: caret + (value.slice(caret, caret + 2) === "]]" ? 2 : 0), query };
}
export function insertNoteLink(
	value: string,
	range: LinkQuery,
	target: string,
): { value: string; caret: number } {
	const link = "[[" + target + "]]";
	return {
		value: value.slice(0, range.start) + link + value.slice(range.end),
		caret: range.start + link.length,
	};
}
