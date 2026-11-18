import { createSuite } from './harness.mjs';
export default function run(mod) {
 const {eq,results}=createSuite('project tag filtering and favorite tags');
 const task=(id,raw,checked=false,due=undefined,path='Work/All.md')=>({id,raw,text:raw,path,line:0,checked,checkbox:true,indent:0,handled:false,due});
 const tasks=[task('a','Send quote #Project/Alpha #project/alpha/urgent',false,'2026-11-18'),task('b','Archive #project/beta',true),task('c','Read `#example` [link](https://a/#url) #personal',false,undefined,'Home.md'),task('d','No tag')];
 eq(mod.inlineTaskTags('Do #Project/A #project/a `#code` %% #comment %% <!-- #hidden --> [[#heading]] https://x/#url \\#escaped #123 #a//b'),['#project/a'],'tags are normalized and exclude code, comments, links, escapes and invalid tags');
 eq([...mod.taskTagCounts(tasks)], [['#project',2],['#project/alpha',1],['#project/alpha/urgent',1],['#project/beta',1],['#personal',1]],'parents count each task once even with overlapping tags');
 const filter=(tag,query='',folder=null,status='all')=>mod.noteGroups(tasks,query,folder,status,'2026-11-18',tag).flatMap(g=>g.tasks.map(t=>t.id));
 eq(filter('#project/ALPHA'),['a'],'tag filter is case insensitive and excludes other projects in the same note');
 eq(filter('#project'),['a','b'],'parent filter includes nested tags');
 eq(filter('#project/al'),[],'tag matching respects path boundaries');
 eq(filter('#project/beta','','Work','open'),[],'status applies to the tagged subset');
 eq(filter('#project/alpha','quote','Work','today'),['a'],'text, folder, date and tag filters combine');
 eq(filter('#project/alpha','Archive'),[],'other tasks in a shared note cannot match a selected project search');
 eq(filter(null).sort(),['a','b','c','d'],'clearing the tag restores all tasks');
 const settings=mod.normalizeSettings({favoriteTaskTags:['Project/Alpha','#PROJECT/alpha','',null,'#personal'],noteTagFilter:'PROJECT/Alpha'});
 eq(settings.favoriteTaskTags,['#project/alpha','#personal'],'favorites normalize and deduplicate independently of detection tags');
 eq(settings.noteTagFilter,'#project/alpha','selection survives settings reload');
 eq(mod.normalizeSettings({favoriteTaskTags:'bad',noteTagFilter:42}).favoriteTaskTags,[],'invalid favorites fall back safely');
 eq(mod.normalizeSettings({noteTagFilter:42}).noteTagFilter,null,'invalid selection clears safely');
 class Node {
  constructor(options={}){this.options=typeof options==='string'?{cls:options}:options;this.children=[];this.attrs={...this.options.attr};this.text=this.options.text;this.value='';}
  createEl(tag,options={}){const n=new Node(options);n.tag=tag;this.children.push(n);return n;}
  createDiv(options={}){return this.createEl('div',options);}
  setAttribute(k,v){this.attrs[k]=v;}
  setText(text){this.text=text;}
  replaceChildren(){this.children=[];}
  querySelector(){return null;}
  focus(){this.focused=true;}
 }
 const all=n=>[n,...n.children.flatMap(all)];
 const root=new Node();let saves=0,changes=0;
 const actions={settings:mod.normalizeSettings(),saveSettings:async()=>{saves++;}};
 mod.renderTaskTagFilter(root,tasks,actions,()=>changes++);
 const button=label=>all(root).find(n=>n.attrs['aria-label']===label);
 const choices=()=>all(root).filter(n=>n.options.cls==='tl-tag-choice');
 eq(choices().length,5,'dropdown discovers task tags including checkbox tags and parents');
 button('Add #project/alpha to favorites').onclick();
 eq(actions.settings.favoriteTaskTags,['#project/alpha'],'star adds favorite without changing task detection');
 eq(actions.settings.taskTags,['#task'],'favorites do not alter detection');
 all(root).find(n=>n.text==='Favorites').onclick();
 eq(choices().map(n=>n.text),['#project/alpha (1)'],'favorites mode shows saved shortcuts');
 choices()[0].onclick();
 eq([actions.settings.noteTagFilter,changes],['#project/alpha',1],'choosing a favorite applies the filter');
 button('Remove #project/alpha from favorites').onclick();
 eq(actions.settings.favoriteTaskTags,[],'unstar removes shortcut');
 eq(choices().length,0,'removing last favorite updates favorites mode');
 eq(actions.settings.noteTagFilter,'#project/alpha','removing a favorite retains the current task filter');
 all(root).find(n=>n.text==='All tags · Clear filter').onclick();
 eq(actions.settings.noteTagFilter,null,'clear restores all tags');
 all(root).find(n=>n.text==='All tags'&&n.tag==='button').onclick();
 const search=button('Find a task tag');search.value='ALPHA';search.oninput();
 eq(choices().map(n=>n.text),['#project/alpha (1)','#project/alpha/urgent (1)'],'dropdown search is case insensitive');
 eq(saves,4,'favorite changes and selections persist');
 const original=JSON.stringify(tasks);
 const stale=new Node();actions.settings.favoriteTaskTags=['#old/project'];
 mod.renderTaskTagFilter(stale,[],actions,()=>{});
 eq(all(stale).find(n=>n.options.cls==='tl-tag-choice').text,'#old/project (0)','unused favorites remain removable');
 eq(JSON.stringify(tasks),original,'favorite operations do not edit notes or tasks');
 return results;
}
