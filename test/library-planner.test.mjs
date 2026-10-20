import { createSuite } from './harness.mjs';
export default function run(mod) {
 const { eq, results } = createSuite('calendar and Gantt shared scheduling');
 const task = { id:'task', text:'Example', due:'2026-10-20', time:'23:30', duration:120 };
 const interval = mod.taskInterval(task);
 eq(interval.start.getDate(), 20, 'start retains local date');
 eq(interval.end.getDate(), 21, 'overnight duration continues next day');
 eq(mod.eventSchedule(interval.start, interval.end, false, task), {due:'2026-10-20',time:'23:30',duration:120}, 'calendar round trip');
 eq(mod.ganttSchedule(interval.start, new Date(interval.end.getTime()-1000), task), {due:'2026-10-20',time:'23:30',duration:120}, 'Frappe inclusive end restores exact minutes');
 eq(mod.taskInterval({...task,due:undefined}), null, 'undated tasks are not silently scheduled');
 const allDay = { ...task,time:undefined,duration:4320 };
 const days = mod.taskInterval(allDay);
 eq(days.end.getDate(), 23, 'all-day multi-day end is exclusive');
 eq(mod.ganttSchedule(days.start,new Date(days.end.getTime()-1000),allDay),{due:'2026-10-20',duration:4320},'multi-day Gantt round trip');
 eq(mod.eventSchedule(days.start,days.end,true,allDay),{due:'2026-10-20',duration:4320},'all-day moves preserve duration and clear time');
 const dst = {...allDay,due:'2026-10-24'};
 const dstDays = mod.taskInterval(dst);
 eq(mod.ganttSchedule(dstDays.start,new Date(dstDays.end.getTime()-1000),dst),{due:'2026-10-24',duration:4320},'all-day duration survives daylight-saving boundary');
 return results;
}
