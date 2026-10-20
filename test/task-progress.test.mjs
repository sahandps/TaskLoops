import {createSuite} from './harness.mjs';
export default async function run(mod) {
 const {eq,results}=createSuite('derived progress for parent tasks and subtasks');
 const task=(id,path,checked=false,parentId)=>({id,path,checked,parentId,checkbox:true,text:id});
 const tasks=[task('parent','Project.md'),task('child','Project.md',true,'parent'),task('grandchild','Project.md',false,'child'),task('sibling','Project.md',true,'parent'),task('other','Other.md',true),{...task('tagged','Project.md',true),checkbox:false}];
 const before=JSON.stringify(tasks);
 eq(mod.noteProgress(tasks).get('Project.md'),{total:4,completed:2,percent:50},'parent and descendants count once at every depth');
 eq(mod.noteProgress(tasks).get('Other.md'),{total:1,completed:1,percent:100},'notes have independent progress');
 eq(mod.noteProgress([]).size,0,'empty scan creates no progress entries');
 eq(JSON.stringify(tasks),before,'calculation never modifies task data');
 const completedParent=tasks.map(t=>t.id==='parent'?{...t,checked:true}:t);
 eq(mod.noteProgress(completedParent).get('Project.md'),{total:4,completed:3,percent:75},'checking a parent does not silently complete its child');
 eq(mod.noteProgress(tasks.filter(t=>t.id!=='grandchild')).get('Project.md'),{total:3,completed:2,percent:67},'deleted checkboxes disappear on the next calculation');
 eq(mod.noteProgress([task('same text','A.md'),task('same text 2','A.md',true)]).get('A.md').total,2,'separate checkboxes count separately');
 const moved=tasks.map(t=>t.path==='Project.md'?{...t,path:'Moved.md'}:t);
 eq(mod.noteProgress(moved).has('Project.md'),false,'old note has no stale progress entry after a move');
 eq(mod.noteProgress(moved).get('Moved.md'),{total:4,completed:2,percent:50},'note moves need no separate progress records');
 const previous=mod.noteProgress(tasks);previous.get('Project.md').completed=99;
 eq(mod.noteProgress(tasks).get('Project.md').completed,2,'each calculation is fresh rather than a growing cache');
 class Node {
  constructor(options={}){this.options=options;this.children=[];}
  createDiv(options={}){const child=new Node(options);this.children.push(child);return child;}
  createSpan(options){return this.createEl('span',options);}
  createEl(tag,options){const child=new Node(options);child.tag=tag;this.children.push(child);return child;}
 }
 const root=new Node();mod.renderTaskProgress(root,'Project.md',mod.noteProgress(tasks).get('Project.md'));
 const bar=root.children[0].children.find(c=>c.tag==='progress');
 eq(bar.options.attr.max,'4','accessible native bar uses the full checkbox count');
 eq(bar.options.attr.value,'2','native bar uses completed checkbox count');
 eq(bar.options.attr['aria-valuetext'],'2 of 4 tasks complete (50%). Includes subtasks.','progress announces counts and hierarchy semantics');
 const empty=new Node();mod.renderTaskProgress(empty,'Empty.md');
 eq(empty.children[0].children.find(c=>c.tag==='progress').options.attr.value,'0','empty progress is determinate at zero');

 const file=Object.assign(new mod.TestFile(),{path:'Project.md',extension:'md'});
 let content='---\nstatus: active\n---\n# Tasks\n- [ ] Parent\n    - [x] Child\n    - [ ] Another child\n';
 const original=content;let writes=0,settingsWrites=0;
 const app={metadataCache:{getFileCache:()=>({listItems:content.split('\n').flatMap((l,i)=>mod.checkboxState(l)!==null?[{task:l.includes('[x]')?'x':' ',position:{start:{line:i}}}]:[])})},vault:{getMarkdownFiles:()=>[file],getAbstractFileByPath:p=>p===file.path?file:null,read:async()=>content,cachedRead:async()=>content,process:async(f,fn)=>{writes++;content=fn(content);}},workspace:{getLeavesOfType:()=>[]}};
 const plugin=new mod.TaskLoopsPlugin();plugin.app=app;plugin.saveData=async()=>{settingsWrites++;};
 await plugin.rescan();
 eq(mod.noteProgress(plugin.allTasks()).get(file.path),{total:3,completed:1,percent:33},'real scanner supplies completed and nested checkboxes');
 eq([content,writes,settingsWrites],[original,0,0],'showing progress writes neither Markdown nor JSON settings');
 const child=plugin.allTasks().find(t=>t.text==='Another child');
 eq(await plugin.complete(child),true,'normal checkbox completion succeeds');
 eq(mod.noteProgress(plugin.allTasks()).get(file.path),{total:3,completed:2,percent:67},'progress refreshes after normal completion');
 eq(content,original.replace('- [ ] Another child','- [x] Another child'),'only the requested checkbox changes; no properties or progress metadata');
 eq(settingsWrites,0,'completion creates no persisted progress data');
 return results;
}
