/** Minimal assertion helper shared by the test files. */
export function createSuite(name) {
	const results = { name, pass: 0, fail: 0, failures: [] };

	const eq = (actual, expected, label) => {
		const a = JSON.stringify(actual);
		const e = JSON.stringify(expected);
		if (a === e) {
			results.pass++;
		} else {
			results.fail++;
			results.failures.push(`${label}\n    expected: ${e}\n    actual:   ${a}`);
		}
	};

	return { eq, results };
}
