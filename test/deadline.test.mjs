import { createSuite } from './harness.mjs';

export default async function run(mod) {
 const { eq, results } = createSuite('deadline persistence and date spans');
 const schedule = { due: '2026-10-20', deadline: '2026-10-22', time: '10:00', duration: 90 };
 const raw = '\t- [ ] Prepare **release** #work ^release\r';
 for (const format of mod.DATE_FORMATS) {
  const written = mod.writeSchedule(raw, schedule, format);
  eq(mod.parseSchedule(written).schedule, schedule, 'deadline round trip: ' + format);
  eq(mod.writeSchedule(written, {}, format), raw, 'remove complete schedule without changing Markdown: ' + format);
 }
 for (const invalid of [
  {deadline:'2026-10-22'}, {due:'2026-10-22',deadline:'2026-10-20'},
  {due:'2026-10-20',deadline:'2026-02-30'},
 ]) eq(mod.validSchedule(invalid), false, 'reject invalid or reversed deadline');
 const invalidRaw = '- [ ] Keep text - Due date: 2026-10-22 Deadline: 2026-10-20';
 eq(mod.parseSchedule(invalidRaw).suffix, '', 'invalid deadline never becomes a different due date');
 eq(mod.parseSchedule(invalidRaw).body, invalidRaw, 'invalid deadline wording stays intact');
 const task = { id: 'deadline', text: 'Prepare release', ...schedule };
 const interval = mod.taskInterval(task);
 eq(mod.localDay(interval.start), '2026-10-20', 'range starts on due date');
 eq(interval.start.getHours(), 0, 'multi-day range starts at midnight despite optional time');
 eq(mod.localDay(interval.end), '2026-10-23', 'deadline includes the final day');
 eq(mod.isAllDayTask(task), true, 'multi-day timed tasks use the all-day row');
 eq(mod.isAllDayTask({...task,deadline:'2026-10-20'}), false, 'same-day timed task stays in hourly grid');
 eq(mod.isAllDayTask({...task,time:undefined,deadline:'2026-10-20'}), true, 'same-day untimed task is all-day');
 eq(mod.eventSchedule(interval.start,interval.end,true,task),schedule,'calendar span round trip preserves effort and optional time');
 eq(mod.ganttSchedule(interval.start,new Date(interval.end.getTime()-1000),task),schedule,'Gantt span round trip preserves effort');
 const moved = {due:'2026-10-22',deadline:'2026-10-24',time:'10:00',duration:90};
 eq(mod.moveTaskToDay(task,'2026-10-22'),moved,'moving shifts both dates by the same calendar days');
 eq(mod.eventSchedule(new Date('2026-10-22T00:00:00'),new Date('2026-10-25T00:00:00'),true,task),moved,'calendar drag shifts the complete date span');
 eq(mod.ganttSchedule(interval.start,new Date('2026-10-24T23:59:59'),task),{...schedule,deadline:'2026-10-24'},'Gantt resize updates deadline without changing duration');
 const dstTask = {...task,due:'2026-10-24',deadline:'2026-10-26'};
 const dst = mod.taskInterval(dstTask);
 eq(mod.localDay(dst.end),'2026-10-27','deadline remains inclusive across DST');
 eq(mod.dayDistance(dstTask.due,dstTask.deadline),2,'date distance ignores DST hour changes');
 eq(mod.eventSchedule(dst.start,dst.end,true,dstTask),{due:'2026-10-24',deadline:'2026-10-26',time:'10:00',duration:90},'DST range keeps its dates and duration');
 const withoutDeadline = mod.writeSchedule(mod.writeSchedule(raw,schedule,'YYYY-MM-DD'),{due:'2026-10-20',time:'10:00',duration:90},'YYYY-MM-DD');
 eq(mod.parseSchedule(withoutDeadline).schedule,{due:'2026-10-20',time:'10:00',duration:90},'deadline can be cleared without removing the rest of the schedule');
 // Exercise the real write service and metadata-backed scanner, not just conversions.
 const file = Object.assign(new mod.TestFile(),{path:'Release.md',extension:'md'});
 let content = '# Release\n\n# Tasks\n';
 const plugin = new mod.TaskLoopsPlugin();
 plugin.app = {
  vault: {getMarkdownFiles:()=>[file],getAbstractFileByPath:()=>file,cachedRead:async()=>content,process:async(_file,fn)=>{content=fn(content);}},
  metadataCache:{getFileCache:()=>({listItems:content.split('\n').flatMap((line,i)=>/^- \[.\]/.test(line)?[{task:' ',position:{start:{line:i}}}]:[])})},
  workspace:{getLeavesOfType:()=>[]},
 };
 eq(await plugin.createTask('Prepare release','Release.md',schedule),true,'create a deadline task through service');
 let saved = plugin.allTasks()[0];
 eq(saved.deadline,'2026-10-22','scanner reads the stored deadline');
 eq(saved.text,'Prepare release','deadline suffix never enters task wording');
 await plugin.schedule(saved,moved);
 saved = plugin.allTasks()[0];
 eq(saved.deadline,'2026-10-24','service stores a moved deadline');
 await plugin.complete(saved);
 eq(plugin.allTasks()[0].deadline,'2026-10-24','completion preserves deadline');
 await plugin.schedule(plugin.allTasks()[0],{});
 eq(plugin.allTasks()[0].deadline,undefined,'removing schedule clears deadline');
 return results;
}
