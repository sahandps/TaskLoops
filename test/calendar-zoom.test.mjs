import {createSuite} from './harness.mjs';
export default function run(mod) {
 const {eq,results}=createSuite('calendar zoom bounds, anchoring and gesture isolation');
 eq(mod.slotHeight(NaN),24,'invalid saved zoom uses the original scale');
 eq(mod.slotHeight(1000),80,'upper limit is bounded');eq(mod.slotHeight(0),12,'lower limit keeps labels usable');
 eq(mod.draggedSlotHeight(24,-100)>24,true,'dragging up zooms in');eq(mod.draggedSlotHeight(24,100)<24,true,'dragging down zooms out');
 eq(mod.draggedSlotHeight(24,-100000),80,'extreme drag clamps at maximum');eq(mod.draggedSlotHeight(24,100000),12,'extreme downward drag clamps at minimum');
 eq(mod.zoomedScroll(20,48,100,200),860,'anchored scroll uses the new time scale');
 const win=new EventTarget(),doc=new EventTarget();doc.defaultView=win;
 let raf=0;const frames=new Map();win.requestAnimationFrame=fn=>{frames.set(++raf,fn);return raf;};win.cancelAnimationFrame=id=>frames.delete(id);
 const flush=()=>{for(const [id,fn] of [...frames]){frames.delete(id);fn();}};
 const attrs={};const axis={setAttribute:(k,v)=>attrs[k]=v,removeAttribute:k=>delete attrs[k],focus:()=>{},closest:()=>axis};
 const grid={closest:()=>null};
 const scroller={scrollTop:480,getBoundingClientRect:()=>({top:100})};
 const body={getBoundingClientRect:()=>({top:160-scroller.scrollTop})};
 const header={getBoundingClientRect:()=>({height:60})};
 const status={setText:()=>{},remove:()=>{}};
 const host=new EventTarget();host.ownerDocument=doc;host.createDiv=()=>status;const classes=new Set();host.classList={add:v=>classes.add(v),remove:v=>classes.delete(v)};
 host.querySelector=selector=>({'.ec-body > .ec-sidebar':axis,'.ec-time-grid > .ec-main':scroller,'.ec-body':body,'.ec-header':header})[selector];
 let size=24;const saves=[];
 const dispose=mod.attachCalendarZoom(host,size,value=>{size=value;},value=>saves.push(value));flush();
 const fire=(el,type,props={})=>{const event=new Event(type,{cancelable:true});const {target,...values}=props;Object.assign(event,{button:0,isPrimary:true,pointerId:1,pointerType:'mouse',clientY:300,...values});Object.defineProperty(event,'target',{value:target??axis});el.dispatchEvent(event);return event;};
 eq(attrs['aria-valuetext'],'100%','time ruler exposes accessible zoom');
 for(const props of [{target:grid},{button:2},{pointerType:'touch'},{isPrimary:false}]) {
  fire(host,'pointerdown',props);fire(doc,'pointermove',{clientY:200});flush();eq(size,24,'grid, touch and non-primary gestures retain their usual behavior');
 }
 const anchor=(300-body.getBoundingClientRect().top)/size;
 fire(host,'pointerdown');fire(doc,'pointermove',{clientY:200});flush();
 eq(size,42,'upward ruler gesture changes the calendar slot size');
 eq(Math.abs((300-body.getBoundingClientRect().top)/size-anchor)<0.00001,true,'initial time remains at the same screen position');
 eq(saves,[],'pointer movement does not repeatedly write preferences');
 fire(doc,'pointerup');eq(saves,[42],'release commits only the final zoom preference');
 eq(classes.has('tl-is-zooming'),false,'release removes drag feedback');
 fire(host,'pointerdown');fire(doc,'pointermove',{clientY:400});flush();fire(doc,'keydown',{key:'Escape'});flush();
 eq(size,42,'Escape restores the starting zoom');eq(saves,[42],'cancelled drag writes no preference');
 fire(host,'keydown',{key:'Home'});flush();fire(host,'keyup',{key:'Home'});
 eq(size,24,'Home resets the original scale');eq(saves,[42,24],'keyboard zoom commits on release');
 fire(host,'pointerdown');fire(doc,'pointermove',{clientY:200});flush();dispose();flush();
 eq(size,24,'view disposal cancels an active zoom');
 fire(doc,'pointermove',{clientY:0});eq(size,24,'disposed gesture listeners do not change zoom');
 return results;
}
