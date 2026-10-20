import {createSuite} from './harness.mjs';
export default async function run(mod) {
 const {eq,results}=createSuite('wikilink editing and target-note isolation');
 const {noteLinkQuery,insertNoteLink}=mod;
 eq(noteLinkQuery('Discuss [[',10),{start:8,end:10,query:''},'empty wikilink starts suggestions');
 const value='Discuss [[Pers]] tomorrow';
 const range=noteLinkQuery(value,14);
 eq(range,{start:8,end:16,query:'Pers'},'existing closing brackets are included');
 eq(insertNoteLink(value,range,'People/Personal'),{value:'Discuss [[People/Personal]] tomorrow',caret:27},'replacement retains surrounding wording and exactly two closing brackets');
 for(const value of ['Plain text','[[Done]]','[[Note|Alias','[[Note#Heading','[[two\nlines']) eq(noteLinkQuery(value,value.length),null,'closed links and manually typed alias/heading are not replaced: '+value);
 const multi='See [[First]] and [[Sec';
 eq(insertNoteLink(multi,noteLinkQuery(multi,multi.length),'Folder/Second').value,'See [[First]] and [[Folder/Second]]','only active link changes');
 const target='---\ntags: [project]\nstatus: active\n---\n# Target\nLeave this untouched.\n';
 const notes=new Map([['Source.md','# Tasks\n'],['Target.md',target]]);
 const files=new Map([...notes.keys()].map(path=>[path,Object.assign(new mod.TestFile(),{path,extension:'md'})]));
 const written=[];
 const app={
  metadataCache:{getFileCache:f=>({listItems:notes.get(f.path).split('\n').flatMap((l,i)=>mod.checkboxState(l)!==null?[{task:' ',position:{start:{line:i}}}]:[])})},
  vault:{getMarkdownFiles:()=>[...files.values()],getAbstractFileByPath:p=>files.get(p),read:async f=>notes.get(f.path),cachedRead:async f=>notes.get(f.path),process:async(f,fn)=>{written.push(f.path);notes.set(f.path,fn(notes.get(f.path)));}},workspace:{getLeavesOfType:()=>[]},
 };
 const plugin=new mod.TaskLoopsPlugin();plugin.app=app;plugin.saveData=async()=>{};
 plugin.settings={dateFormat:'YYYY-MM-DD',standaloneNote:'Source.md',scanFolder:'',defaultDuration:30};
 await plugin.rescan();
 eq(await plugin.createTask('Discuss [[Target]]','Source.md',{}),true,'linked title is a normal source task');
 const task=plugin.allTasks().find(t=>t.text==='Discuss [[Target]]');
 eq(await plugin.editTask(task,'Discuss [[Target|the project]]','Source.md',{},['Review [[Target#Details]]'],[],'Waiting for [[Target]]'),true,'links persist in edited title, draft subtask and reason');
 eq(notes.get('Target.md'),target,'linked note body and properties remain byte-for-byte unchanged');
 eq([...new Set(written)],['Source.md'],'all writes are confined to the source note');
 const source=notes.get('Source.md');
 eq(source.includes("Can't schedule now: Waiting for [[Target]]"),true,'reason retains link markup');
 eq(source.includes('    - [ ] Review [[Target#Details]]'),true,'subtask link remains indented Markdown');
 eq(plugin.allTasks().some(t=>t.text==='Discuss [[Target|the project]]'),true,'scanner preserves link aliases');
 return results;
}
