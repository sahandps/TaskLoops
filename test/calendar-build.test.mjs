import esbuild from 'esbuild';
import vm from 'node:vm';
import ts from 'typescript';
import {localCalendarPlugin,localOnlyCalendar} from '../scripts/calendar-build.mjs';
import {createSuite} from './harness.mjs';
export default async function run() {
 const {eq,results}=createSuite('local-only calendar transport');
 let calls=0;
 const context={fetch:()=>{calls++;throw new Error('Network must not be used');}};
 const adapted=localOnlyCalendar('fetch("https://example.invalid/feed").catch(e=>e.message)');
 eq(await vm.runInNewContext(adapted,context),'Remote calendar feeds are disabled in TaskLoops.','unused remote feed rejects explicitly');
 eq(calls,0,'disabled feed makes no network request');
 for(const source of ['const a=1;', 'fetch("a");fetch("b");']) {
  let rejected=false;try{localOnlyCalendar(source);}catch{rejected=true;}
  eq(rejected,true,'upstream transport changes require review');
 }
 const built=await esbuild.build({entryPoints:['src/main.ts'],bundle:true,write:false,platform:'browser',format:'cjs',external:['obsidian'],plugins:[localCalendarPlugin()]});
 const production=ts.createSourceFile('main.js',built.outputFiles[0].text,ts.ScriptTarget.Latest,true);
 const outbound=[];
 const visit=node=>{
  if((ts.isCallExpression(node)||ts.isNewExpression(node)) && /^(fetch|requestUrl|XMLHttpRequest|WebSocket|EventSource)$/.test(node.expression.getText(production))) outbound.push(node.expression.getText(production));
  ts.forEachChild(node,visit);
 };
 visit(production);
 eq(outbound,[],'production bundle has no outbound request API calls');
 return results;
}
