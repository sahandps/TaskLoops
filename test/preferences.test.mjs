import { createSuite } from './harness.mjs';
export default async function run(mod) {
 const {eq,results}=createSuite('date formats and planner preferences');
 const {DATE_FORMATS,formatDate,parseDate,parseSchedule,writeSchedule,formatTime,TaskLoopsPlugin,TestFile}=mod;
 for(const day of ['2026-01-02','2026-10-16','2024-02-29','2026-12-31']) {
  for(const format of DATE_FORMATS) {
   eq(parseDate(formatDate(day,format)),day,'date round trip '+format+' '+day);
   const schedule={due:day,time:'00:05',duration:65};
   const raw='\t- [ ] **Keep task** #tag ^id\r';
   const written=writeSchedule(raw,schedule,format);
   eq(parseSchedule(written).schedule,schedule,'all fields round trip '+format+' '+day);
   eq(writeSchedule(written,{},format),raw,'clearing preserves Markdown '+format+' '+day);
  }
 }
 eq(parseDate('03/04/2026'),'2026-04-03','legacy slash dates always stay day-first');
 for(const date of ['31 February 2026','Feb 29, 2026','2026/02-28','Foo 2, 2026','20261301','0/1/2026']) eq(parseDate(date),undefined,'reject invalid '+date);
 eq(formatTime('00:05','12h'),'12:05 AM','12-hour midnight');
 eq(formatTime('12:30','12h'),'12:30 PM','12-hour noon');
 eq(formatTime('23:59','12h'),'11:59 PM','12-hour evening');
 eq(formatTime('14:05','24h'),'14:05','24-hour display');
 eq(mod.weekOf('2026-10-16',0)[0],'2026-10-11','Sunday week begins Sunday');
 eq(mod.weekOf('2026-10-16',6)[0],'2026-10-10','Saturday week begins Saturday');
 eq(mod.monthGrid('2026-10',0)[0],'2026-09-27','month uses chosen week start');
 const file=Object.assign(new TestFile(),{path:'Test.md',extension:'md'});let content='';
 const plugin=new TaskLoopsPlugin();
 plugin.settings={...plugin.settings,defaultDuration:45,dateFormat:'MMMM D, YYYY'};
 plugin.app={vault:{getAbstractFileByPath:()=>file,getMarkdownFiles:()=>[file],cachedRead:async()=>content,process:async(_file,fn)=>{content=fn(content);}},metadataCache:{getFileCache:()=>({listItems:content.split('\n').flatMap((line,i)=>/^\s*- \[.\]/.test(line)?[{task:' ',position:{start:{line:i}}}]:[])})},workspace:{getLeavesOfType:()=>[]}};
 await plugin.createTask('New timed task','Test.md',{due:'2026-10-16',time:'14:00'});
 eq(plugin.allTasks()[0].duration,45,'new timed task receives selected duration');
 eq(content.includes('Due date: October 16, 2026'),true,'month-name format writes to Markdown');
 plugin.settings.defaultDuration=90;
 await plugin.schedule(plugin.allTasks()[0],{due:'2026-10-17',time:'10:00'});
 eq(plugin.allTasks()[0].duration,45,'rescheduling retains existing duration');
 await plugin.createTask('Undated task','Test.md',{});
 eq(plugin.allTasks().find(t=>t.text==='Undated task').duration,undefined,'default duration leaves undated tasks undated');
 return results;
}
