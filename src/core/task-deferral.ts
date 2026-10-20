import type { ScannedTask, TaskDeferral } from "./types";

function continuation(raw: string): string {
	const container = raw.match(/^([ \t]*(?:>[ \t]*)*)(?:[-*+]|\d+[.)])[ \t]+\[.\]/)?.[1];
	if (container === undefined) throw new Error("Choose a Markdown checkbox task.");
	return container + "    ";
}

/** Only direct continuations belong to this task, never a child's reason. */
export function readDeferral(block: string[]): TaskDeferral | undefined {
	const prefix = continuation(block[0]) + "Can't schedule now: ";
	let previous: TaskDeferral | undefined;
	for (const raw of block.slice(1)) {
		if (!raw.startsWith(prefix)) continue;
		const text = raw.slice(prefix.length).trim();
		const history = text.match(/^(.*) — Scheduled on (\d{4}-\d{2}-\d{2}) for (\d{4}-\d{2}-\d{2})$/);
		if (!text) continue;
		if (!history) return { reason: text };
		previous ??= { reason: history[1], scheduledOn: history[2], scheduledFor: history[3] };
	}
	return previous;
}

export function isDeferred(task: Pick<ScannedTask, "checked" | "deferral">): boolean {
	return !task.checked && !!task.deferral && !task.deferral.scheduledOn;
}

export function validateDeferralReason(reason: string): string {
	const value = reason.trim();
	if (!value || /[\r\n]/.test(value) || value.length > 1000 || value.includes(" — Scheduled on "))
		throw new Error("Enter a reason on one line (up to 1,000 characters).");
	return value;
}

/** Insert a Shift+Enter-style continuation and retain earlier scheduling history. */
export function deferBlock(block: string[], reason: string): string[] {
	const value = validateDeferralReason(reason);
	const next = [...block];
	const prefix = continuation(next[0]) + "Can't schedule now: ";
	const active = next.findIndex(
		(line, index) =>
			index > 0 &&
			line.startsWith(prefix) &&
			!/ — Scheduled on \d{4}-\d{2}-\d{2} for \d{4}-\d{2}-\d{2}\s*$/.test(line),
	);
	const cr = next[0].endsWith("\r") ? "\r" : "";
	const line = prefix + value + cr;
	if (active >= 0) next.splice(active, 1);
	next.splice(1, 0, line);
	next[0] = next[0].trimEnd() + "  " + cr;
	return next;
}

/** Scheduling resolves the active reason in the same Markdown write. */
export function resolveDeferral(block: string[], due: string | undefined, today: string): string[] {
	if (!due) return block;
	const next = [...block];
	const prefix = continuation(next[0]) + "Can't schedule now: ";
	for (let i = 1; i < next.length; i++) {
		const line = next[i];
		if (
			!line.startsWith(prefix) ||
			/ — Scheduled on \d{4}-\d{2}-\d{2} for \d{4}-\d{2}-\d{2}\s*$/.test(line)
		)
			continue;
		const cr = line.endsWith("\r") ? "\r" : "";
		next[i] = line.trimEnd() + ` — Scheduled on ${today} for ${due}` + cr;
		next[0] = next[0].trimEnd() + "  " + (next[0].endsWith("\r") ? "\r" : "");
	}
	return next;
}
