import { createSuite } from './harness.mjs';
export default async function run(mod) {
 const {eq,results}=createSuite('deferral reasons, history and safe scheduling');
 const {deferBlock,resolveDeferral,readDeferral,isDeferred}=mod;
 const root=['- [ ] Call supplier','    Preserve my note.','    - [ ] Compare quotes','        Keep child details.'];
 const deferred=deferBlock(root,'Waiting for a quote');
 eq(deferred,['- [ ] Call supplier  ',"    Can't schedule now: Waiting for a quote",...root.slice(1)],'reason is an indented soft-break continuation, not a new task');
 eq(readDeferral(deferred),{reason:'Waiting for a quote'},'reason can be read back from Markdown');
 eq(isDeferred({checked:false,deferral:readDeferral(deferred)}),true,'unfinished reason appears in waiting section');
 eq(isDeferred({checked:true,deferral:readDeferral(deferred)}),false,'finished task leaves waiting section');
 const updated=deferBlock(deferred,'Waiting for approval');
 eq(updated.filter(l=>l.includes("Can't schedule now:")).length,1,'editing reason replaces active line without duplication');
 eq(readDeferral(updated).reason,'Waiting for approval','updated reason persists');
 const scheduled=resolveDeferral(updated,'2026-10-23','2026-10-20');
 eq(scheduled[1],"    Can't schedule now: Waiting for approval — Scheduled on 2026-10-20 for 2026-10-23",'scheduling records actual action day and chosen schedule day');
 eq(isDeferred({checked:false,deferral:readDeferral(scheduled)}),false,'resolved history is not an active blocker');
 eq(resolveDeferral(scheduled,'2026-10-25','2026-10-21'),scheduled,'subsequent date changes preserve original history');
 eq(resolveDeferral(updated,undefined,'2026-10-20'),updated,'clearing a date does not resolve reason');
 const again=deferBlock(scheduled,'Waiting again');
 eq(again.filter(l=>l.includes("Can't schedule now:")).length,2,'new deferral retains earlier resolved history');
 eq(readDeferral(again).reason,'Waiting again','latest active reason takes priority');
 eq(readDeferral([again[0],again[2],again[1]]).reason,'Waiting again','active reason is found even below history');
 eq(readDeferral(['- [ ] Parent','    - [ ] Child',"        Can't schedule now: Child only"]),undefined,'parent never adopts a child reason');
 const quoted=deferBlock(['>   1. [ ] Quoted\r','>       Keep this\r'],'Waiting');
 eq(quoted,['>   1. [ ] Quoted  \r',">       Can't schedule now: Waiting\r",'>       Keep this\r'],'numbered/quoted indentation and CRLF are preserved');
 eq(readDeferral(quoted),{reason:'Waiting'},'quoted reason round trip');
 for(const invalid of ['', 'two\nlines', 'x'.repeat(1001), 'Reserved — Scheduled on text']) {
  let rejected=false;try {deferBlock(root,invalid);} catch {rejected=true;}
  eq(rejected,true,'invalid reason cannot inject or corrupt continuation: '+invalid.slice(0,15));
 }
 const file=Object.assign(new mod.TestFile(),{path:'Project.md',extension:'md'});
 let writes=0;
 let content='# Tasks\r\n- [ ] Call supplier - Due date: 2026-10-15\r\n    Keep the note.\r\n    - [ ] Compare quotes\r\n';
 const app={
  metadataCache:{getFileCache:()=>({listItems:content.split('\n').flatMap((l,i)=>mod.checkboxState(l)!==null?[{task:l.includes('[x]')?'x':' ',position:{start:{line:i}}}]:[])})},
  vault:{getMarkdownFiles:()=>[file],getAbstractFileByPath:p=>p===file.path?file:null,cachedRead:async()=>content,read:async()=>content,process:async(_f,fn)=>{content=fn(content);writes++;}},
  workspace:{getLeavesOfType:()=>[]},
 };
 const plugin=new mod.TaskLoopsPlugin();plugin.app=app;
 plugin.settings={dateFormat:'YYYY-MM-DD',standaloneNote:'Project.md',scanFolder:'',defaultDuration:30};plugin.saveData=async()=>{};
 await plugin.rescan();
 const originalTask=plugin.allTasks().find(t=>t.text==='Call supplier');
 eq(await plugin.deferTask(originalTask,'Waiting for quote'),true,'existing task defers safely');
 eq(content.includes("- [ ] Call supplier  \r\n    Can't schedule now: Waiting for quote\r\n    Keep the note."),true,'defer clears schedule and keeps note content/EOL');
 eq(plugin.allTasks().length,2,'reason is never scanned as an extra task');
 const waiting=plugin.allTasks().find(t=>t.text==='Call supplier');
 eq(waiting.deferral,{reason:'Waiting for quote'},'scanner discovers persisted reason');
 eq(waiting.due,undefined,'deferred task no longer retains old due date');
 const beforeWrites=writes;
 await plugin.schedule(waiting,{due:'2026-10-23'});
 eq(writes,beforeWrites+1,'schedule and reason resolution use a single note transaction');
 eq(content.includes(`Can't schedule now: Waiting for quote — Scheduled on ${mod.todayISO()} for 2026-10-23`),true,'normal scheduling writes history in the note');
 eq(content.includes('    Keep the note.\r\n    - [ ] Compare quotes'),true,'scheduling retains descendants and prose');
 const resumed=plugin.allTasks().find(t=>t.text==='Call supplier');
 eq(isDeferred(resumed),false,'scanner reads resolved history');
 eq(resumed.due,'2026-10-23','schedule persists with history');
 eq(await plugin.deferTask(resumed,'Waiting again'),true,'task can be deferred again');
 const waitingAgain=plugin.allTasks().find(t=>t.text==='Call supplier');
 eq(await plugin.editTask(waitingAgain,'Call supplier','Project.md',{due:'2026-10-24',deadline:'2026-10-26'}),true,'editor scheduling also resolves reason');
 eq(content.includes(`Waiting again — Scheduled on ${mod.todayISO()} for 2026-10-24`),true,'editor writes resolution alongside edited schedule');
 eq(plugin.allTasks().find(t=>t.text==='Call supplier').deadline,'2026-10-26','deadline-only edit participates in schedule comparison');
 eq(await plugin.createTask('New waiting task','Project.md',{},'Waiting for dates'),true,'new task and reason are one write');
 const added=plugin.allTasks().find(t=>t.text==='New waiting task');
 eq(added.deferral,{reason:'Waiting for dates'},'new deferred task is discoverable');
 eq(content.includes("- [ ] New waiting task  \r\n    Can't schedule now: Waiting for dates\r\n"),true,'new task respects destination CRLF');
 eq(await plugin.complete(added),true,'waiting task can be completed');
 eq(await plugin.deferTask(added,'Cannot defer completed'),false,'completed task cannot be re-deferred');
 const before=content;
 eq(await plugin.createTask('Invalid','Project.md',{due:'2026-10-23'},'Reason'),false,'new task cannot be both deferred and scheduled');
 eq(content,before,'invalid create changes nothing');
 const queued={...waiting,checked:false,deferral:{reason:'Waiting'}};
 eq(mod.reviewTasks([queued],'',false,'deferred','2026-10-20').listed.length,1,'waiting filter includes active reason');
 eq(mod.reviewTasks([queued],'',false,'undated','2026-10-20').listed.length,0,'ordinary unscheduled excludes separate waiting section');
 eq(mod.reviewTasks([{...queued,checked:true}],'',true,'deferred','2026-10-20').listed.length,0,'completed waiting tasks are excluded even with show completed');
 eq(mod.reviewTasks([{...queued,deferral:{reason:'Was waiting',scheduledOn:'2026-10-20'}}],'',false,'deferred','2026-10-20').deferredCount,0,'resolved history is not counted');
 const child=plugin.allTasks().find(t=>t.text==='Compare quotes');
 content=content.replace('- [ ] Compare quotes','- [ ] Updated externally');
 const external=content;
 eq(await plugin.deferTask(child,'Stale selection'),false,'stale selection cannot defer the wrong task');
 eq(content,external,'failed deferral preserves intervening text');
 return results;
}
