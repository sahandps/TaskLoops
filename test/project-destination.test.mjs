import { createSuite } from './harness.mjs';
export default async function run(mod) {
 const {eq,results}=createSuite('project note destination and Tasks heading');
 const {appendTask,TaskLoopsPlugin,TestFile}=mod;
 const original='---\r\nkind: project\r\n---\r\n\r\n# Our Home\r\nLast line of the note.';
 const expected=original+'\r\n\r\n# Tasks\r\n- [ ] Chop wood\r\n';
 eq(appendTask(original,'- [ ] Chop wood'),expected,'missing Tasks heading is appended after last note line');
 eq(appendTask(expected,'- [ ] Sweep yard'),expected+'- [ ] Sweep yard\r\n','next task reuses the heading');
 eq(appendTask('# Tasks\n- [ ] Existing\n\n# Other\nLeave alone.\n','- [ ] New'),'# Tasks\n- [ ] Existing\n- [ ] New\n\n# Other\nLeave alone.\n','existing Tasks section is reused without touching following content');
 eq(appendTask('## Tasks:\n- [ ] Existing\n','- [ ] New'),'## Tasks:\n- [ ] Existing\n- [ ] New\n','legacy heading remains supported');
 const file=Object.assign(new TestFile(),{path:'Projects/Our Home.md',extension:'md'});
 let content=original;
 const plugin=new TaskLoopsPlugin();
 plugin.app={vault:{getAbstractFileByPath:path=>path===file.path?file:null,process:async(_file,fn)=>{content=fn(content);},cachedRead:async()=>content},metadataCache:{getFileCache:()=>({listItems:[]})},workspace:{getLeavesOfType:()=>[]}};
 eq(await plugin.createTask('Chop wood',file.path,{}),true,'task is created in explicitly selected existing project');
 eq(content,expected,'selected project receives checkbox under appended heading');
 return results;
}
