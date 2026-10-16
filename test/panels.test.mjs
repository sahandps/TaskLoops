import { createSuite } from './harness.mjs';
export default async function run(mod) {
 const {eq,results}=createSuite('panel sizing and note navigation');
 eq(mod.panelSize(340,1200,false),340,'desktop divider uses requested width');
 eq(mod.panelSize(20,1200,false),180,'sidebar stays usable');
 eq(mod.panelSize(1100,1200,false),908,'calendar retains minimum space');
 eq(mod.panelSize(220,600,true),220,'stacked layout uses requested height');
 eq(mod.panelSize(590,600,true),428,'stacked calendar retains space');
 eq(mod.panelSize(500,300,false),120,'small containers stay within bounds');
 eq(mod.panelSize(NaN,1200,false),260,'invalid width uses default');
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
