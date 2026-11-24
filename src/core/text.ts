/** Shorten to `n` characters, ending with an ellipsis when cut. */
export function truncate(s: string, n: number): string {
	if (s.length <= n) return s;
	return s.slice(0, n - 1).replace(/\s+$/, "") + "…";
}

/** Show link labels in task lists and charts while keeping Markdown in the note and editor. */
export function taskDisplayTitle(text: string): string {
	const links =
		/(`+)[^\n]*?\1|\\.|!?\[\[([^[\]\n]+)\]\]|!?\[((?:\\.|[^[\]\\\n]|\[[^\]\n]*\])*)\]\((?:\\.|[^()\\\n]|\((?:\\.|[^()\\\n])*\))*\)/g;
	return text.replace(links, (match, _code, wiki: string | undefined, label: string | undefined) => {
		if (wiki) return wiki.split("|").at(-1) || wiki;
		return label || match;
	});
}
