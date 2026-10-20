import {createSuite} from './harness.mjs';
export default async function run(mod) {
 const {eq,results}=createSuite('local Today agenda, mobile actions and rollover');
 const task=(id,s={})=>({id,text:id,path:'Project.md',line:0,checkbox:true,checked:false,...s});
 const day='2026-10-20',t=(id,s={})=>task(id,{due:day,...s});
 const tasks=[t('evening',{time:'17:00'}),t('afternoon',{time:'12:00'}),t('morning',{time:'10:00',duration:60}),t('early',{time:'08:00'}),t('all-day'),t('span',{due:'2026-10-19',deadline:day,time:'11:00'}),t('done-parent',{checked:true}),t('child',{parentId:'done-parent'}),t('overnight',{due:'2026-10-19',time:'23:30',duration:90}),t('ends-midnight',{due:'2026-10-19',time:'23:00',duration:60}),t('tomorrow',{due:'2026-10-21'}),task('undated'),t('old',{due:'2026-10-15'}),t('deadline-old',{due:'2026-10-01',deadline:'2026-10-16'}),t('completed-old',{due:'2026-10-01',checked:true})];
 const original=JSON.stringify(tasks),a=mod.todayAgenda(tasks,day),ids=entries=>entries.map(e=>e.task?.id??e.id);
 eq(ids(a.allDay),['span','all-day','child'],'all-day includes the final deadline day and independently open children');
 eq(ids(a.morning),['overnight','early','morning'],'timed tasks sort chronologically, including overnight carryover');
 eq(ids(a.afternoon),['afternoon'],'noon begins afternoon');eq(ids(a.evening),['evening'],'17:00 begins evening');
 eq(ids(a.completed),['done-parent'],'completed parents do not hide unfinished children');
 eq(a.morning[0].continuing,true,'overnight continuation is explicit');
 eq(a.entries.some(e=>e.task.id==='ends-midnight'),false,'exclusive midnight end belongs to yesterday');
 eq(a.entries.some(e=>e.task.id==='tomorrow'),false,'future tasks stay out of Today');
 eq(a.entries.some(e=>e.task.id==='undated'),false,'unscheduled tasks do not invent a date');
 eq(ids(a.overdue),['old','deadline-old','ends-midnight'],'overdue sorts by oldest final day and omits ongoing spans and completed tasks');
 eq(a.remaining,8,'remaining count includes every parent and child separately');
 eq(a.progress,{total:9,completed:1,percent:11},'daily progress counts only checkbox tasks intersecting today');
 eq(JSON.stringify(tasks),original,'building an agenda has no note/task mutations');
 eq(mod.todayAgenda([],day).progress,{total:0,completed:0,percent:0},'empty day has finite zero progress');
 const tagged=mod.todayAgenda([t('tagged',{checkbox:false,checked:true})],day);
 eq(tagged.progress.total,0,'tagged text is not counted as a checkbox');
 eq(mod.todayAgenda([t('bad',{due:'bad-date'})],day).entries.length,0,'invalid dates cannot crash the view');
 for(const d of ['2026-03-29','2026-10-25']) {
  const x=mod.todayAgenda([task('dst',{due:d}),task('boundary',{due:mod.shiftISO(d,-1),deadline:d})],d);
  eq(x.allDay.length,2,'local-day spans survive DST transition '+d);
 }
 eq(mod.normalizeSettings({defaultView:'today'}).defaultView,'today','Today can be saved as the default view');
 const plugin=new mod.TaskLoopsPlugin();plugin.settings=mod.normalizeSettings();plugin.saveSettings=async()=>{};plugin.refreshViews=()=>{};
 const defs=new mod.TaskLoopsSettingTab({},plugin).getSettingDefinitions();let changed;const options=[];const dropdown={addOption:(k)=>{options.push(k);return dropdown;},setValue:()=>dropdown,onChange:fn=>{changed=fn;return dropdown;}};
 defs.find(d=>d.name==='Default view').render({addDropdown:fn=>fn(dropdown)});await changed('today');
 eq(options.includes('today'),true,'native settings exposes Today as a default choice');eq(plugin.settings.defaultView,'today','default view dropdown persists Today');
 class Node {
  constructor(tag='',options={}){this.tag=tag;this.options=typeof options==='string'?{cls:options}:options;this.children=[];this.attrs={...this.options.attr};this.text=this.options.text;}
  createEl(tag,options={}){const child=new Node(tag,options);this.children.push(child);return child;}
  createDiv(options={}){return this.createEl('div',options);}
  createSpan(options={}){return this.createEl('span',options);}
  addEventListener(){}
  setAttribute(k,v){this.attrs[k]=v;}
 }
 const all=n=>[n,...n.children.flatMap(all)];
 let completed=[],edited=[],revealed=[],scheduled=[],created=[];
 const actions={settings:{timeFormat:'24h',dateFormat:'YYYY-MM-DD'},allTasks:()=>tasks,noteName:p=>p.replace('.md',''),complete:async t=>{completed.push(t.id);return true;},reveal:async t=>revealed.push(t.id),schedule:async(t,s)=>scheduled.push({id:t.id,...s}),newTask:s=>created.push(s)};
 const render=(options={})=>{const root=new Node();mod.renderTodayView(root,{...actions,...options},t=>edited.push(t.id),new Date(day+'T10:30:00'),options.expanded);return all(root);};
 const nodes=render();
 eq(nodes.filter(n=>n.tag==='section').map(n=>n.attrs['aria-label']),['All day','Morning','Afternoon','Evening'],'mobile sections have a consistent reading order and accessible headings');
 eq(nodes.filter(n=>n.options.cls==='tl-today-phase').map(n=>n.text),['Earlier','Earlier','Now','Upcoming','Upcoming'],'time badges reflect current local time');
 eq(nodes.find(n=>n.attrs['aria-label']==="Today's task progress").attrs.max,'9','native daily progress exposes full checkbox count');
 eq(nodes.filter(n=>n.tag==='details').every(n=>!n.open),true,'overdue and completed start collapsed');
 eq(nodes.filter(n=>n.tag==='summary').map(n=>n.text),['Overdue · 3','Completed · 1'],'secondary sections have separate task counts');
 eq(nodes.filter(n=>n.tag==='button'&&n.attrs['aria-label']==='Edit morning').length,1,'scheduled task appears once');
 nodes.find(n=>n.attrs['aria-label']==='Edit morning').onclick();eq(edited,['morning'],'title opens the existing task editor');
 nodes.find(n=>n.attrs['aria-label']==='Open Project.md in a new tab').onclick();eq(revealed.length,1,'source control uses existing note navigation');
 const checkbox=nodes.find(n=>n.attrs['aria-label']==='Complete morning');checkbox.onchange();await Promise.resolve();
 eq(completed,['morning'],'checkbox uses the existing safe completion action');
 nodes.find(n=>n.options.cls==='tl-today-plan').onclick();eq(scheduled[0],{id:'old',due:mod.todayISO()},'overdue action plans for current local day');
 const expanded=new Set(['overdue']);const detail=render({expanded}).find(n=>n.tag==='details');eq(detail.open,true,'open secondary section survives refresh');detail.open=false;detail.ontoggle();eq(expanded.size,0,'folding updates only transient display state');
 const twelve=render({settings:{...actions.settings,timeFormat:'12h',showWeekNumbers:false,showProgressBars:false}});
 eq(twelve.some(n=>n.tag==='time'&&n.text==='10:00 AM'),true,'agenda times follow the time display preference');
 eq(twelve.some(n=>n.text==='Before 12:00 PM'),true,'period labels also use the preferred time format');
 eq(twelve.some(n=>n.options.cls==='tl-today-week'),false,'week number setting applies to Today');
 eq(twelve.some(n=>n.tag==='progress'),false,'progress setting applies to Today');
 const empty=render({allTasks:()=>[]});eq(empty.some(n=>n.text==='A little room in your day.'),true,'empty day has a clear calm state');empty.find(n=>n.text==='Add a task for today').onclick();eq(created,[{due:mod.todayISO()}],'empty-state creation prefills today');
 const done=render({allTasks:()=>[t('done',{checked:true})]});eq(done.some(n=>n.text==="Today's tasks are complete."),true,'completed-only day shows a useful finish state');
 const header=new Node();mod.renderViewHeader(header,actions,{mode:'today'},()=>{});all(header).find(n=>n.text==='+ Task').onclick();eq(created.length,2,'header Add task also targets today');
 eq(all(header).filter(n=>n.attrs['aria-pressed']).map(n=>n.text),['Today','Planner','Notes'],'Today is available in the main switch');
 const doc=new EventTarget(),win=new EventTarget();doc.defaultView=win;doc.visibilityState='visible';let tick,cleared=0,refresh=0;win.setTimeout=fn=>{tick=fn;return 7;};win.clearTimeout=id=>{if(id===7)cleared++;};
 const dispose=mod.attachTodayClock({ownerDocument:doc},()=>refresh++);tick();eq(refresh,1,'minute clock refreshes current day and time phases');doc.dispatchEvent(new Event('visibilitychange'));win.dispatchEvent(new Event('focus'));eq(refresh,3,'wake and window focus re-evaluate the actual current day');
 doc.visibilityState='hidden';doc.dispatchEvent(new Event('visibilitychange'));eq(refresh,3,'background visibility event does not render');dispose();tick();win.dispatchEvent(new Event('focus'));eq(refresh,3,'closed view removes the clock and listeners');eq(cleared,1,'view cleanup cancels pending timeout');
 return results;
}
