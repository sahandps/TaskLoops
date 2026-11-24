import { createSuite } from './harness.mjs';
export default async function run(mod) {
 const {eq,results}=createSuite('panel sizing and note navigation');
 eq(mod.sidebarShare(0.3),0.3,'divider preserves the requested share');
 eq(mod.sidebarShare(0),0.18,'sidebar retains a usable share');
 eq(mod.sidebarShare(1),0.55,'calendar retains space');
 eq(mod.sidebarShare(NaN),0.25,'missing or invalid share uses the default');
 const plugin=new mod.TaskLoopsPlugin();
 const file=new mod.TestFile();let opened=[],type;
 plugin.app={vault:{getAbstractFileByPath:path=>path==='Project.md'?file:null},workspace:{getLeaf:t=>{type=t;return{openFile:async(...args)=>opened.push(args)};}}};
 eq(await plugin.openNote('Project.md'),true,'open selected project note');
 eq(type,'tab','project note uses a new tab');
 eq(opened[0][1],{active:true},'project opens without an unrelated task line');
 await plugin.reveal({path:'Project.md',line:17});
 eq(opened[1][1],{eState:{line:17},active:true},'source button jumps to task line');
 eq(await plugin.openNote('Missing.md'),false,'uncreated destination is handled');
 eq(opened.length,2,'navigation never creates an empty destination note');
 return results;
}
