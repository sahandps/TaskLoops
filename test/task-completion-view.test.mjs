import {createSuite} from './harness.mjs';
export default function run(mod) {
 const {eq,results}=createSuite('unfinished first and separate completed lists');
 const task=(id,path,checked=false,parentId)=>({id,text:id,path,checked,parentId,line:0,checkbox:true});
 const tasks=[task('done-old','A.md',true),task('parent','B.md',true),task('child','B.md',false,'parent'),task('open','C.md'),task('done-child','C.md',true,'open')];
 const ids=list=>list.map(t=>t.id);
 const original=JSON.stringify(tasks);
 eq(ids(mod.completionView(tasks).tasks),['child','open'],'unfinished tasks take priority even when completed notes sort first');
 eq(ids(mod.completionView(tasks,'completed').tasks),['done-old','parent','done-child'],'completed tasks have a separate view');
 eq(mod.completionView(tasks.slice(0,2)).selected,'completed','completed-only results are shown automatically');
 eq(mod.completionView(tasks.filter(t=>!t.checked),'completed').selected,'open','unfinished-only results cannot be hidden behind an empty completed tab');
 eq(mod.completionView([]).tasks,[],'empty filters remain empty');
 eq(JSON.stringify(tasks),original,'partitioning never changes task content or properties');
 class Node {
  constructor(options={}){this.options=typeof options==='string'?{cls:options}:options;this.children=[];this.attrs={...this.options.attr};this.text=this.options.text;this.hidden=false;}
  createEl(tag,options={}){const child=new Node(options);child.tag=tag;child.parentElement=this;this.children.push(child);return child;}
  createDiv(options={}){return this.createEl('div',options);}
  createSpan(options={}){return this.createEl('span',options);}
  setAttribute(k,v){this.attrs[k]=v;}
  setText(text){this.text=text;}
  querySelector(){return null;}
  closest(){return null;}
 }
 const all=node=>[node,...node.children.flatMap(all)];
 const state=()=>({query:'',showDone:true,taskFilter:'all',noteFilter:'all',folder:null,collapsedNotes:new Set(),expandedNotes:new Set()});
 const root=new Node(),s=state();let changes=0;
 eq(ids(mod.renderTaskCompletionTabs(root,tasks,s,()=>changes++)),['child','open'],'tabs initially render unfinished parents and children independently');
 const tabs=all(root).filter(n=>n.attrs['data-completion-tab']);
 eq(tabs.map(n=>n.text),['Unfinished 2','Completed 3'],'tab counts include every nested checkbox once');
 eq(tabs.map(n=>n.attrs['aria-pressed']),['true','false'],'selected tab is accessible');
 tabs[1].onclick();eq(s.completionTab,'completed','completed tab can be selected');eq(changes,1,'selection requests a list refresh');
 const actions={allTasks:()=>tasks,settings:{showProgressBars:false,notePreviewLimit:5},noteName:p=>p,reveal:()=>{},newTask:()=>{}};
 const planner=(st)=>{const root=new Node(),rendered=[];const result=mod.renderPlannerSidebar(root,actions,st,(p,t)=>{rendered.push(t.id);return p.createDiv();},()=>{},()=>{},()=>{});return{root,rendered,result};};
 eq(planner(state()).rendered,['child','open'],'Planner hides completed-only notes from the unfinished tab');
 eq(ids(planner(state()).result.matching),ids(tasks),'calendar still receives all matching tasks when Show completed is on');
 eq(planner({...state(),completionTab:'completed'}).rendered,['done-old','parent','done-child'],'Planner completed tab retains source order');
 eq(planner({...state(),showDone:false,completionTab:'completed'}).rendered,['child','open'],'hiding completed bypasses the completed tab');
 eq(all(planner({...state(),showDone:false}).root).filter(n=>n.attrs['data-completion-tab']).length,0,'Planner tabs appear only with Show completed enabled');
 eq(planner({...state(),query:'A.md'}).rendered,['done-old'],'completed-only search results show automatically');
 const notes=(st)=>{const root=new Node(),rendered=[];mod.renderNotesView(root,actions,st,(p,t)=>{rendered.push(t.id);return p.createDiv();},()=>{});return{root,rendered};};
 eq(notes(state()).rendered,['child','open'],'Notes also keeps unfinished work above completed-only notes');
 eq(notes({...state(),completionTab:'completed'}).rendered,['done-old','parent','done-child'],'Notes has its own completed list with all completed subtasks');
 eq(notes({...state(),query:'A.md'}).rendered,['done-old'],'Notes completed-only search is not empty');
 eq(all(notes(state()).root).filter(n=>n.options.cls==='tl-note-card').length,2,'completed-only note cards are absent from unfinished Notes');
 eq(all(notes(state()).root).filter(n=>n.tag==='span'&&n.text==='1 open · 2 total').length,2,'note totals include tasks in both tabs');
 eq(JSON.stringify(tasks),original,'rendering both views causes no task or property changes');
 return results;
}
