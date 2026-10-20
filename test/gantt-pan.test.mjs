import {createSuite} from './harness.mjs';
export default function run(mod) {
 const {eq,results}=createSuite('Gantt background pan and interaction isolation');
 class Surface extends EventTarget {
  constructor(kind='grid'){super();this.kind=kind;this.classList={add:v=>this.classes.add(v),remove:v=>this.classes.delete(v)};this.classes=new Set();}
  closest(selector){return selector==='.gantt'?this:(this.kind==='bar'?this:null);}
 }
 {
  const win=new EventTarget(),doc=new EventTarget();doc.defaultView=win;
  const scroller=new Surface();Object.assign(scroller,{ownerDocument:doc,scrollLeft:200,scrollTop:100});
  const fire=(el,type,props={})=>{const e=new Event(type,{cancelable:true});const {target,...values}=props;Object.assign(e,{button:0,isPrimary:true,pointerId:1,clientX:100,clientY:100,...values});Object.defineProperty(e,'target',{value:target??scroller});el.dispatchEvent(e);return e;};
  const dispose=mod.attachGanttPan(scroller);
  fire(scroller,'pointerdown');fire(doc,'pointermove',{clientX:98,clientY:99});
  eq([scroller.scrollLeft,scroller.scrollTop],[200,100],'small motion does not pan');
  fire(doc,'pointermove',{clientX:70,clientY:80});
  eq([scroller.scrollLeft,scroller.scrollTop],[230,120],'left drag scrolls both axes');
  eq(scroller.classes.has('tl-is-panning'),true,'drag cursor is active');
  scroller.scrollLeft+=500;fire(doc,'pointermove',{clientX:60,clientY:80});
  eq(scroller.scrollLeft,740,'incremental pan tolerates vendor infinite-range rebasing');
  fire(doc,'pointerup');fire(doc,'pointermove',{clientX:0});
  eq(scroller.scrollLeft,740,'release stops pan');
  eq(scroller.classes.has('tl-is-panning'),false,'release restores cursor');
  for(const props of [{button:2},{isPrimary:false},{pointerType:'touch'},{target:new Surface('bar')}]) {
   fire(scroller,'pointerdown',props);fire(doc,'pointermove',{clientX:0});
   eq(scroller.scrollLeft,740,'buttons and bar/handle interactions are left alone');
  }
  fire(scroller,'pointerdown');fire(win,'blur');fire(doc,'pointermove',{clientX:0});
  eq(scroller.scrollLeft,740,'window blur cancels dragging');
  fire(scroller,'pointerdown');dispose();fire(doc,'pointermove',{clientX:0});
  eq(scroller.scrollLeft,740,'view cleanup cancels active dragging');
  fire(scroller,'pointerdown');fire(doc,'pointermove',{clientX:0});
  eq(scroller.scrollLeft,740,'disposed view has no pan listeners');
 }
 return results;
}
