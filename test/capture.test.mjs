import { createSuite } from "./harness.mjs";

const TAG = "#task";
const MARKER = "*(Handled)*";

export default function run(mod) {
	const { cleanTaskText, hasHandledMarker, stripHandledMarker } = mod;
	const { eq, results } = createSuite("capture & marking");

	/** The exact line captureTask writes. */
	const captureLine = (text) => `- ${text.trim()} ${TAG}`;

	/** The exact transform setHandledMarker applies. */
	const setMarker = (line, on) => {
		const bare = stripHandledMarker(line).replace(/\s+$/, "");
		return on ? bare + " " + MARKER : bare;
	};

	// --- captured lines read back as what was typed --------------------------
	for (const text of [
		"Call the dentist",
		"Get quotes from three movers",
		"Buy milk, bread, and eggs",
		"Reply to Nima about Q3.",
		"Fix the #urgent bug",
		"Read 'Designing Data-Intensive Applications'",
		"  padded input  ",
	]) {
		eq(
			cleanTaskText(captureLine(text), TAG),
			text.trim().replace(/\s+/g, " "),
			`round-trip: ${text.trim()}`
		);
	}

	eq(hasHandledMarker(captureLine("Something")), false, "fresh capture is unmarked");

	// --- marking is idempotent and reversible --------------------------------
	const line = captureLine("Measure the desks");
	const once = setMarker(line, true);
	eq(once, "- Measure the desks #task *(Handled)*", "marker appended once");
	eq(setMarker(once, true), once, "marker append is idempotent");
	eq(setMarker(once, false), line, "marker removal restores the original line");
	eq(setMarker(line, false), line, "removing an absent marker is a no-op");
	eq(
		cleanTaskText(once, TAG),
		cleanTaskText(line, TAG),
		"marking does not change the task text"
	);

	// --- marking never disturbs surrounding structure ------------------------
	const prefix = (s) => s.slice(0, s.length - s.trimStart().length);
	for (const raw of [
		"- [ ] Renew the car insurance #task",
		"\t- Give notice on the old lease #task",
		"> Read the Kleppmann book #task",
		"## A heading task #task",
		"Some prose with a task hidden #task in the middle of it.",
	]) {
		const marked = setMarker(raw, true);
		const label = raw.slice(0, 28);
		eq(setMarker(marked, false), raw, `round-trip preserves: ${label}`);
		eq(cleanTaskText(marked, TAG), cleanTaskText(raw, TAG), `text stable: ${label}`);
		eq(prefix(marked), prefix(raw), `indent preserved: ${label}`);
	}

	eq(
		setMarker("- Trailing space task #task   ", true),
		"- Trailing space task #task *(Handled)*",
		"trailing whitespace collapsed once"
	);

	return results;
}
