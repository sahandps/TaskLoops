import postcss from "postcss";

export const PLANNER_SCOPE = ".tl-view .tl-library-planner";

/** Scope vendor selectors, while retaining their native nested rules and keyframes. */
export function scopeVendorStyles(css) {
	const root = postcss.parse(css);
	root.walkRules((rule) => {
		// Nested selectors already inherit the containing rule's scope.
		for (let parent = rule.parent; parent && parent.type !== "root"; parent = parent.parent) {
			if (parent.type === "rule" || (parent.type === "atrule" && /keyframes$/i.test(parent.name)))
				return;
		}
		rule.selectors = rule.selectors.map((selector) => {
			if (selector === ":root") return PLANNER_SCOPE;
			if (selector === "html[data-theme=dark]") return `.theme-dark ${PLANNER_SCOPE}`;
			return `${PLANNER_SCOPE} ${selector}`;
		});
	});
	return root.toString();
}
