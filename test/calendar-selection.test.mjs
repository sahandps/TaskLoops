import { createSuite } from './harness.mjs';

export default function run(mod) {
 const { eq, results } = createSuite('calendar range creation');
 const start = new Date('2026-10-21T07:20:00');
 const end = new Date('2026-10-21T11:10:00');
 const timed = {due:'2026-10-21',time:'07:20',duration:230};
 eq(mod.selectionSchedule(start,end,false),timed,'reported 07:20–11:10 selection pre-fills 3h50m');
 eq(mod.selectionSchedule(new Date('2026-10-21T23:30:00'),new Date('2026-10-22T00:00:00'),false),{due:'2026-10-21',time:'23:30',duration:30},'exact midnight does not add an extra deadline day');
 eq(mod.selectionSchedule(new Date('2026-10-21T23:30:00'),new Date('2026-10-22T01:00:00'),false),{due:'2026-10-21',deadline:'2026-10-22',time:'23:30',duration:90},'overnight selection preserves the date span');
 eq(mod.selectionSchedule(new Date('2026-10-20T00:00:00'),new Date('2026-10-24T00:00:00'),true),{due:'2026-10-20',deadline:'2026-10-23'},'multi-day selection gets inclusive deadline and no effort duration');
 eq(mod.selectionSchedule(new Date('2026-10-20T00:00:00'),new Date('2026-10-21T00:00:00'),true),{due:'2026-10-20',deadline:'2026-10-20'},'one-day selection stays one day');
 eq(mod.selectionSchedule(new Date('2026-10-24T00:00:00'),new Date('2026-10-27T00:00:00'),true),{due:'2026-10-24',deadline:'2026-10-26'},'all-day selection keeps calendar dates over DST');
 eq(mod.selectionSchedule(start,start,false),null,'empty selection does not create a draft');
 eq(mod.selectionSchedule(end,start,false),null,'invalid reversed input does not create a draft');
 eq(mod.selectionSchedule(new Date('invalid'),end,false),null,'invalid dates do not reach the dialog');
 const drafts=[];
 const actions=[];
 const handlers=mod.createCalendarCreationHandlers({settings:{defaultDuration:45},create:(schedule,path)=>{actions.push('create');drafts.push({schedule,path});}},()=>actions.push('clear'));
 handlers.select({start,end,allDay:false,resource:{id:'Projects/Launch.md'}});
 eq(actions,['clear','create'],'range selection clears highlight and opens exactly one dialog');
 eq(drafts,[{schedule:timed,path:'Projects/Launch.md'}],'timeline selection passes its source note to creation');
 handlers.dateClick({date:start,allDay:false});
 eq(drafts[1],{schedule:{due:'2026-10-21',time:'07:20',duration:45}},'single click still uses default duration');
 handlers.dateClick({date:start,allDay:true,resource:{id:'Projects/Launch.md'}});
 eq(drafts[2],{schedule:{due:'2026-10-21'},path:'Projects/Launch.md'},'all-day click uses date and source note');
 handlers.select({start,end:start,allDay:false});
 eq(drafts.length,3,'invalid selection clears highlight without opening a dialog');
 return results;
}
