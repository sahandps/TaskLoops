import { setImmediate } from 'node:timers/promises';
import { createSuite } from './harness.mjs';

export default async function run(mod) {
 const { eq, results } = createSuite('completion controls');
 const task = { id: 'sample', text: 'Review', checked: false };
 const make = (task, complete, onCompleted) => {
  const handlers = {};
  const parent = { createEl: (_tag, options) => ({ options, addEventListener: (type, listener) => { handlers[type] = listener; } }) };
  return { check: mod.renderCompletionCheckbox(parent, task, complete, onCompleted), handlers };
 };
 let finish;
 let called = 0;
 let acknowledged = 0;
 const {check,handlers} = make(task, value => { called++; eq(value,task,'completion receives saved task'); return new Promise(resolve=>{finish=resolve;}); },()=>acknowledged++);
 eq(check.options.attr['aria-label'],'Complete Review','checkbox has accessible task label');
 eq([check.checked,check.disabled],[false,false],'pending task is actionable');
 let stopped = 0;
 for(const type of ['pointerdown','mousedown','click','keydown','keyup']) handlers[type]({stopPropagation:()=>stopped++});
 eq(stopped,5,'pointer and keyboard completion do not trigger dragging or editor');
 check.checked = true;
 check.onchange();
 eq([called,check.disabled,acknowledged],[1,true,0],'write is pending and disabled before acknowledging');
 finish(true);
 await setImmediate();
 eq([check.checked,check.disabled,acknowledged],[true,true,1],'successful write is acknowledged once');
 const failed = make(task,async()=>false,()=>acknowledged++).check;
 failed.checked = true; failed.onchange();
 await setImmediate();
 eq([failed.checked,failed.disabled,acknowledged],[false,false,1],'refused write restores checkbox without false success');
 const rejected = make(task,async()=>{throw new Error('write failed');}).check;
 rejected.checked = true; rejected.onchange();
 await setImmediate();
 eq([rejected.checked,rejected.disabled],[false,false],'rejected write restores checkbox for retry');
 const done = make({...task,checked:true},async()=>true).check;
 eq([done.checked,done.disabled],[true,true],'completed task stays checked');
 return results;
}
