import {createSuite} from './harness.mjs';
export default function run(mod) {
 const {eq,results}=createSuite('task group folding across Planner and Notes');
 class Node {
  constructor(options={}){this.children=[];this.attrs={...options.attr};this.text=options.text;this.hidden=false;}
  createEl(_tag,options={}){const child=new Node(options);this.children.push(child);return child;}
  createSpan(options){return this.createEl('span',options);}
  setAttribute(key,value){this.attrs[key]=value;}
  setText(value){this.text=value;}
 }
 const collapsed=new Set(['Filtered-out.md']);
 const planner=mod.taskGroupFolds(collapsed),controls=new Node();planner.controls(controls);
 const all=controls.children[0];
 eq(all.disabled,true,'empty list has no bulk fold action');
 const heading=new Node(),body=new Node();planner.add('Project.md',heading,body,40);
 const toggle=heading.children[0];
 eq(body.hidden,false,'task groups start visible');
 eq(toggle.attrs['aria-expanded'],'true','visible group advertises expanded state');
 eq(all.text,'Collapse all','bulk action starts with collapse');
 toggle.onclick();
 eq(body.hidden,true,'individual fold hides all tasks in the group');
 eq(collapsed.has('Project.md'),true,'fold state is retained outside the renderer');
 eq(toggle.attrs['aria-expanded'],'false','collapsed state is accessible');
 eq(all.text,'Expand all','bulk action offers expansion when all visible groups are folded');
 const secondHead=new Node(),secondBody=new Node();planner.add('Second.md',secondHead,secondBody,3);
 const duplicateHead=new Node(),duplicateBody=new Node();planner.add('Project.md',duplicateHead,duplicateBody,2);
 eq(duplicateBody.hidden,true,'repeated overdue note headings share folding state');
 all.onclick();
 eq([body.hidden,secondBody.hidden,duplicateBody.hidden],[true,true,true],'collapse all affects every matching group');
 eq(collapsed.has('Filtered-out.md'),true,'bulk actions leave filtered-out notes unchanged');
 all.onclick();
 eq([body.hidden,secondBody.hidden,duplicateBody.hidden],[false,false,false],'expand all restores task bodies');
 eq(collapsed.has('Filtered-out.md'),true,'expanding matching groups does not expand unrelated notes');
 toggle.onclick();
 const notes=mod.taskGroupFolds(collapsed),notesHead=new Node(),notesBody=new Node();notes.add('Project.md',notesHead,notesBody,42);
 eq(notesBody.hidden,true,'Notes view inherits the same note fold state');
 notesHead.children[0].onclick();
 eq(notesBody.hidden,false,'note card can expand independently through its header');
 const refreshed=mod.taskGroupFolds(collapsed),refreshHead=new Node(),refreshBody=new Node();refreshed.add('Project.md',refreshHead,refreshBody,41);
 eq(refreshBody.hidden,false,'completion/refresh preserves the latest fold choice');
 eq(heading.children.length,1,'fold action does not replace note headings or source-note actions');
 return results;
}
