import postcss from "postcss";

export const PLANNER_SCOPE = ".tl-view .tl-library-planner";

/** Scope vendor selectors, while retaining their native nested rules and keyframes. */
export function scopeVendorStyles(css) {
	const root = postcss.parse(css);
	root.walkRules((rule) => {
		const column = rule.nodes?.find((node) => node.type === "decl" && node.prop === "column-gap");
		const row = rule.nodes?.find((node) => node.type === "decl" && node.prop === "row-gap");
		if (column) {
			column.prop = "gap";
			column.value = `${row?.value ?? "normal"} ${column.value}`;
			row?.remove();
		}
	});
	root.walkRules((rule) => {
		// Nested selectors already inherit the containing rule's scope.
		for (let parent = rule.parent; parent && parent.type !== "root"; parent = parent.parent) {
			if (parent.type === "rule" || (parent.type === "atrule" && /keyframes$/i.test(parent.name)))
				return;
		}
		const priority = rule.nodes?.some((node) => node.type === "decl" && node.important);
		rule.walkDecls((decl) => {
			decl.important = false;
		});
		const scope = priority ? ".tl-view.tl-view .tl-library-planner.tl-library-planner" : PLANNER_SCOPE;
		rule.selectors = rule.selectors.map((selector) => {
			if (selector === ":root") return scope;
			if (selector === "html[data-theme=dark]") return `.theme-dark ${scope}`;
			return `${scope} ${selector}`;
		});
	});
	return root.toString();
}
