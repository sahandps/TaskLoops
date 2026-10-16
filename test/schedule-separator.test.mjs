import { createSuite } from './harness.mjs';
export default async function run(mod) {
 const {eq,results}=createSuite('schedule separators and manually typed dates');
 const {parseSchedule,writeSchedule,cleanTaskText,scanFile}=mod;
 const schedule={due:'2026-10-19',time:'08:20',duration:50};
 const text='Protect sensitive information with Microsoft Purview in the AI era';
 const legacy='- [ ] '+text+' Due date: 2026-10-19 Time: 08:20 Duration: 50 Minutes';
 const separated='- [ ] '+text+' - Due date: 2026-10-19 Time: 08:20 Duration: 50 Minutes';
 eq(parseSchedule(legacy).schedule,schedule,'previous format remains readable');
 eq(parseSchedule(separated).schedule,schedule,'separator format schedules the task');
 eq(cleanTaskText(separated,'#task'),text,'separator is not part of task title');
 eq(writeSchedule(legacy,schedule,'YYYY-MM-DD'),separated,'new writes separate details from wording');
 eq(writeSchedule(separated,schedule,'YYYY-MM-DD'),separated,'repeat writes do not duplicate separators');
 eq(writeSchedule(separated,{},'YYYY-MM-DD'),'- [ ] '+text,'removing schedule also removes separator');
 for(const date of ['- date: 2026-10-19','date: 2026-10-19','- Due date: 2026-10-19']) eq(parseSchedule('- [ ] Task '+date).schedule,{due:'2026-10-19'},'manual suffix '+date);
 eq(parseSchedule('- [ ] Task - DATE: 2026-10-19 Time: 08:20 Duration: 50 Minutes').schedule,schedule,'manual alias includes time and duration');
 eq(parseSchedule('- [ ] Task - date: 2026-02-30').suffix,'','invalid manual date stays in wording');
 eq(writeSchedule('- [ ] Task - date: 2026-10-19 ^id\r',schedule,'YYYY-MM-DD'),'- [ ] Task - Due date: 2026-10-19 Time: 08:20 Duration: 50 Minutes ^id\r','manual date normalizes on explicit edit, preserving block and CRLF');
 const raw='- [ ] Task - date: 2026-10-19\n- An ordinary bullet - date: 2026-10-19';
 const app={metadataCache:{getFileCache:()=>({listItems:[{task:' ',position:{start:{line:0}}},{position:{start:{line:1}}}]})},vault:{cachedRead:async()=>raw}};
 const tasks=await scanFile(app,{path:'Note.md'},'#task','checkboxes');
 eq(tasks.length,1,'ordinary bullet is not a task');
 eq(tasks[0].due,'2026-10-19','manually typed date is discovered for calendar');
 return results;
}
