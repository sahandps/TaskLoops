import { createSuite } from './harness.mjs';
export default async function run(mod) {
 const {eq,results}=createSuite('inline note task actions and mobile opening');
 const {noteTaskRows,locateNoteTask,TaskLoopsPlugin,TestPlatform}=mod;
 const content=['---','example: "- [ ] Property"','---','```md','- [ ] Code example','```','    - [ ] Indented code','','- An ordinary bullet','- [ ] Parent - date: 2026-10-19','    - [ ] Child','- [x] Completed','> - [ ] Quoted','- [ ] Duplicate','- [ ] Duplicate'].join('\n');
 const rows=noteTaskRows(content,'Note.md');
 eq(rows.map(t=>t.text),['Parent','Child','Completed','Quoted','Duplicate','Duplicate'],'only real task rows receive controls');
 eq(rows[0].due,'2026-10-19','inline task reads scheduling suffix');
 eq(rows[1].parentId,rows[0].id,'nested task hierarchy is preserved');
 eq(rows[2].checked,true,'completed task remains editable');
 eq(rows[4].id===rows[5].id,false,'duplicate tasks keep distinct occurrence ids');
 eq(locateNoteTask(rows,14,'- [ ] Duplicate').line,14,'exact duplicate line targets correct row');
 eq(locateNoteTask(rows,99,'- [ ] Duplicate'),undefined,'moved duplicate cannot be guessed');
 eq(locateNoteTask(rows,99,rows[0].raw).line,9,'unique moved task can be relocated');
 eq(locateNoteTask(rows,9,'- [ ] Reworded'),undefined,'changed task does not target stale source');
 eq(noteTaskRows('~~~\n- [ ] Hidden\n~~~\n- [ ] Visible','N.md').length,1,'tilde code fence is skipped');
 eq(noteTaskRows('> ```\n> - [ ] Hidden\n> ```\n> - [ ] Visible','N.md').length,1,'quoted code fence is skipped');
 eq(noteTaskRows('<!--\n- [ ] Hidden\n-->\n<pre>\n- [ ] Hidden\n</pre>\n- [ ] Visible','N.md').map(t=>t.text),['Visible'],'comments and HTML code examples are excluded');
 const root={},other={};let created=0,detached=0,revealed;
 const sidebar={getRoot:()=>other,detach:()=>{detached++;}};
 const main={getRoot:()=>root,setViewState:async()=>{}};
 const plugin=new TaskLoopsPlugin();
 plugin.app={workspace:{rootSplit:root,getLeavesOfType:()=>[sidebar],getLeaf:type=>{eq(type,'tab','mobile creates a main tab');created++;return main;},getRightLeaf:()=>{throw Error('Must not open right sidebar on mobile');},revealLeaf:async leaf=>{revealed=leaf;}}};
 TestPlatform.isMobile=true;
 try {
  await plugin.activateView();
  eq(created,1,'mobile opens the planner once');
  eq(detached,1,'old mobile sidebar instance is removed after opening');
  eq(revealed,main,'mobile main tab is revealed');
  plugin.app.workspace.getLeavesOfType=()=>[main];
  await plugin.activateView();
  eq(created,1,'repeated mobile opening reuses the main tab');
 } finally {TestPlatform.isMobile=false;}
 return results;
}
