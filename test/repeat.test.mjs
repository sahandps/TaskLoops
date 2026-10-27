import { createSuite } from './harness.mjs';

export default async function run(mod) {
 const { eq, results } = createSuite('repeating tasks');
 const rule = (t) => mod.parseRepeat(t);
 const next = (t, anchor, after = anchor) => mod.nextOccurrence(rule(t), anchor, after);
 const series = (t, anchor, n) => {
  const out = []; let at = anchor;
  for (let i = 0; i < n; i++) { at = next(t, anchor, at); if (!at) break; out.push(at); }
  return out;
 };
 // Rules: round trip and rejection of anything unsupported.
 for (const text of [
  'FREQ=DAILY', 'FREQ=DAILY;INTERVAL=3', 'FREQ=WEEKLY;BYDAY=MO,WE,FR', 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU',
  'FREQ=MONTHLY;BYMONTHDAY=15,-1', 'FREQ=MONTHLY;BYDAY=2TU', 'FREQ=MONTHLY;BYDAY=-1FR',
  'FREQ=YEARLY;BYMONTH=1,4,7,10;BYMONTHDAY=1', 'FREQ=WEEKLY;BYDAY=MO;UNTIL=2026-12-31', 'FREQ=DAILY;COUNT=10',
 ]) eq(mod.formatRepeat(rule(text)), text, 'canonical round trip: ' + text);
 for (const bad of [
  '', 'FREQ=HOURLY', 'INTERVAL=2', 'FREQ=DAILY;INTERVAL=0', 'FREQ=WEEKLY;BYDAY=XX', 'FREQ=WEEKLY;BYDAY=2MO',
  'FREQ=MONTHLY;BYMONTHDAY=32', 'FREQ=MONTHLY;BYDAY=MO;BYMONTHDAY=1', 'FREQ=DAILY;BYDAY=MO', 'FREQ=DAILY;UNTIL=2026-02-30',
  'FREQ=DAILY;FREQ=DAILY', 'FREQ=DAILY;COUNT=0', 'FREQ=DAILY;X=1', 'FREQ=MONTHLY;BYMONTH=1',
 ]) eq(mod.validRepeat(bad), false, 'reject invalid rule: "' + bad + '"');
 // 2026-10-26 is a Monday.
 eq(series('FREQ=DAILY;INTERVAL=3', '2026-10-26', 3), ['2026-10-29', '2026-11-01', '2026-11-04'], 'every 3 days');
 eq(series('FREQ=WEEKLY;BYDAY=MO,WE,FR', '2026-10-26', 5), ['2026-10-28', '2026-10-30', '2026-11-02', '2026-11-04', '2026-11-06'], 'Mon/Wed/Fri keeps its days');
 eq(series('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU', '2026-10-27', 3), ['2026-11-10', '2026-11-24', '2026-12-08'], 'every other Tuesday');
 eq(series('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE', '2026-10-26', 4), ['2026-10-28', '2026-11-09', '2026-11-11', '2026-11-23'], 'biweekly with two weekdays stays aligned');
 eq(series('FREQ=MONTHLY;BYMONTHDAY=15,-1', '2026-10-15', 4), ['2026-10-31', '2026-11-15', '2026-11-30', '2026-12-15'], '15th and last day of each month');
 eq(series('FREQ=MONTHLY;BYMONTHDAY=31', '2026-01-31', 3), ['2026-02-28', '2026-03-31', '2026-04-30'], 'day 31 clamps to short months');
 eq(series('FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=1', '2026-10-01', 3), ['2026-12-01', '2027-02-01', '2027-04-01'], 'every other month');
 eq(series('FREQ=MONTHLY;BYDAY=2TU', '2026-10-13', 3), ['2026-11-10', '2026-12-08', '2027-01-12'], 'second Tuesday of the month');
 eq(series('FREQ=MONTHLY;BYDAY=-1FR', '2026-10-30', 3), ['2026-11-27', '2026-12-25', '2027-01-29'], 'last Friday of the month');
 eq(series('FREQ=YEARLY;BYMONTH=1,4,7,10;BYMONTHDAY=1', '2026-10-01', 4), ['2027-01-01', '2027-04-01', '2027-07-01', '2027-10-01'], 'quarterly months');
 eq(series('FREQ=YEARLY;BYMONTHDAY=29;BYMONTH=2', '2028-02-29', 2), ['2029-02-28', '2030-02-28'], 'Feb 29 yearly clamps in common years');
 eq(series('FREQ=WEEKLY;BYDAY=MO;UNTIL=2026-11-09', '2026-10-26', 5), ['2026-11-02', '2026-11-09'], 'until ends the series');
 // Completion successor: late tasks skip ahead; count and deadline span follow.
 const base = { due: '2026-10-26', time: '09:00', duration: 45, repeat: 'FREQ=DAILY' };
 eq(mod.nextRepeatSchedule(base, '2026-10-26'), { due: '2026-10-27', time: '09:00', duration: 45, repeat: 'FREQ=DAILY' }, 'on-time completion moves one step');
 eq(mod.nextRepeatSchedule(base, '2026-11-02').due, '2026-11-03', 'a late task skips to the next future date');
 eq(mod.nextRepeatSchedule({ ...base, due: '2026-10-30' }, '2026-10-26').due, '2026-10-31', 'early completion follows the task date');
 eq(mod.nextRepeatSchedule({ due: '2026-10-26', deadline: '2026-10-28', repeat: 'FREQ=WEEKLY;BYDAY=MO' }, '2026-10-26'), { due: '2026-11-02', deadline: '2026-11-04', repeat: 'FREQ=WEEKLY;BYDAY=MO' }, 'deadline span keeps its length');
 eq(mod.nextRepeatSchedule({ due: '2026-10-26', repeat: 'FREQ=DAILY;COUNT=3' }, '2026-10-26').repeat, 'FREQ=DAILY;COUNT=2', 'count goes down');
 eq(mod.nextRepeatSchedule({ due: '2026-10-26', repeat: 'FREQ=DAILY;COUNT=1' }, '2026-10-26'), undefined, 'last counted occurrence ends the series');
 eq(mod.nextRepeatSchedule({ repeat: 'FREQ=DAILY' }, '2026-10-26'), undefined, 'no due date means no repeat');
 eq(mod.describeRepeat(rule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE')), 'Every 2 weeks on Mon and Wed', 'describe weekly');
 eq(mod.describeRepeat(rule('FREQ=MONTHLY;BYMONTHDAY=15,-1;COUNT=4')), 'Every month on day 15 and the last day, 4 times', 'describe monthly');
 eq(mod.describeRepeat(rule('FREQ=MONTHLY;BYDAY=-1FR')), 'Every month on the last Friday', 'describe last weekday');
 // Markdown: marker round trip, clearing and validity.
 const raw = '- [ ] Water plants #home ^plants';
 const schedule = { due: '2026-10-26', time: '09:00', duration: 30, repeat: 'FREQ=WEEKLY;BYDAY=MO,FR' };
 for (const format of mod.DATE_FORMATS) {
  const written = mod.writeSchedule(raw, schedule, format);
  eq(mod.parseSchedule(written).schedule, schedule, 'repeat marker round trip: ' + format);
  eq(mod.parseSchedule(written).body, '- [ ] Water plants #home', 'repeat marker never enters wording: ' + format);
 }
 const written = mod.writeSchedule(raw, schedule, 'YYYY-MM-DD');
 eq(mod.parseSchedule(mod.writeSchedule(written, { due: '2026-10-27', time: '09:00', duration: 30 }, 'YYYY-MM-DD')).schedule.repeat, 'FREQ=WEEKLY;BYDAY=MO,FR', 'moving a task keeps its repeat');
 eq(mod.parseSchedule(mod.writeSchedule(written, { due: '2026-10-27', repeat: '' }, 'YYYY-MM-DD')).schedule.repeat, undefined, 'empty repeat clears the rule');
 eq(mod.writeSchedule(written, {}, 'YYYY-MM-DD'), raw, 'clearing the schedule removes the repeat too');
 eq(mod.validSchedule({ repeat: 'FREQ=DAILY' }), false, 'repeat needs a due date');
 eq(mod.validSchedule({ due: '2026-10-26', repeat: 'FREQ=NOPE' }), false, 'invalid repeat is rejected');
 // The next occurrence block: subtasks come back unchecked, ids and notes stay behind.
 const block = [
  '- [ ] Weekly review - Due date: 2026-10-26 Time: 09:00 Duration: 30 Minutes <!-- taskloops-repeat:FREQ=WEEKLY;BYDAY=MO --> ^review',
  "    Can't schedule now: earlier",
  '    - [x] Gather notes ^notes',
  '    - [ ] Write summary',
 ];
 eq(mod.repeatBlock(block, '2026-10-26', 'YYYY-MM-DD'), [
  '- [ ] Weekly review - Due date: 2026-11-02 Time: 09:00 Duration: 30 Minutes <!-- taskloops-repeat:FREQ=WEEKLY;BYDAY=MO -->',
  '    - [ ] Gather notes',
  '    - [ ] Write summary',
 ], 'next block is fresh and contains no copied block ids');
 // End to end through the real service and scanner.
 const file = Object.assign(new mod.TestFile(), { path: 'Home.md', extension: 'md' });
 let content = '# Home\n\n# Tasks\n';
 const plugin = new mod.TaskLoopsPlugin();
 plugin.app = {
  vault: { getMarkdownFiles: () => [file], getAbstractFileByPath: () => file, cachedRead: async () => content, process: async (_f, fn) => { content = fn(content); } },
  metadataCache: { getFileCache: () => ({ listItems: content.split('\n').flatMap((line, i) => /^\s*- \[.\]/.test(line) ? [{ task: ' ', position: { start: { line: i } } }] : []) }) },
  workspace: { getLeavesOfType: () => [] },
 };
 const today = mod.todayISO();
 eq(await plugin.createTask('Stretch', 'Home.md', { due: today, repeat: 'FREQ=DAILY;COUNT=2' }), true, 'create a repeating task');
 let tasks = plugin.allTasks();
 eq(tasks[0].repeat, 'FREQ=DAILY;COUNT=2', 'scanner reads the repeat rule');
 eq(tasks[0].text, 'Stretch', 'wording stays clean');
 await plugin.complete(tasks[0]);
 tasks = plugin.allTasks();
 eq(tasks.length, 2, 'completing adds the next occurrence');
 eq(tasks.map((t) => t.checked), [true, false], 'old one is done and the new one is open');
 eq(tasks[1].due, mod.shiftISO(today, 1), 'next occurrence is tomorrow');
 eq(tasks[1].repeat, 'FREQ=DAILY;COUNT=1', 'remaining count is reduced');
 await plugin.complete(tasks[1]);
 eq(plugin.allTasks().length, 2, 'the final counted occurrence does not repeat again');
 return results;
}
