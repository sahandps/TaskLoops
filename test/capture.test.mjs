import { createSuite } from "./harness.mjs";

const TAG = "#task";

export default function run(mod) {
	const { checkboxState, cleanTaskText, markCheckboxDone } = mod;
	const { eq, results } = createSuite("capture & completion");

	const checkboxCapture = (text) => `- [ ] ${text.trim()}`;
	const taggedCapture = (text) => `- [ ] ${text.trim()} ${TAG}`;

	for (const text of [
		"Call the dentist",
		"Get quotes from three movers",
		"Buy milk, bread, and eggs",
		"Reply to Nima about Q3.",
		"Fix the #urgent bug",
		"Read 'Designing Data-Intensive Applications'",
		"  padded input  ",
	]) {
		for (const line of [checkboxCapture(text), taggedCapture(text)]) {
			eq(
				cleanTaskText(line, TAG),
				text.trim().replace(/\s+/g, " "),
				`round-trip: ${text.trim()}`
			);
			eq(checkboxState(line), false, `captured unchecked: ${text.trim()}`);
		}
	}

	for (const line of [
		"- [ ] Renew the car insurance",
		"\t- [ ] Give notice on the old lease #task",
		"> - [ ] Read the Kleppmann book",
		"1. [ ] File the report ^report",
	]) {
		const done = markCheckboxDone(line);
		eq(done.replace("[x]", "[ ]"), line, `only checkbox changed: ${line}`);
		eq(checkboxState(done), true, `completion detected: ${line}`);
		eq(markCheckboxDone(done), done, `completion idempotent: ${line}`);
	}

	return results;
}
