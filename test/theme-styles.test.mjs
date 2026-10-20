import { readFile } from 'node:fs/promises';
import postcss from 'postcss';
import { scopeVendorStyles, PLANNER_SCOPE } from '../scripts/vendor-styles.mjs';
import { createSuite } from './harness.mjs';

export default async function run() {
 const { eq, results } = createSuite('theme isolation and palette coverage');
 const gui = postcss.parse(await readFile('src/gui/styles.css', 'utf8'));
 const componentVariables = selector => {
  const variables = new Map();
  gui.walkRules(rule => { if (rule.selector === selector) rule.walkDecls(decl => variables.set(decl.prop,decl.value)); });
  return variables;
 };
 const ganttPalette = componentVariables(`${PLANNER_SCOPE} .gantt-container`);
 const calendarPalette = componentVariables(`${PLANNER_SCOPE} .ec`);
 for (const path of ['node_modules/frappe-gantt/dist/frappe-gantt.css','node_modules/@event-calendar/core/dist/index.css']) {
  const source = await readFile(path,'utf8');
  const scoped = postcss.parse(scopeVendorStyles(source));
  const leaks = [];
  scoped.walkRules(rule => {
   for (let parent = rule.parent; parent && parent.type !== 'root'; parent=parent.parent) {
    if (parent.type === 'rule' || (parent.type === 'atrule' && /keyframes$/i.test(parent.name))) return;
   }
   leaks.push(...rule.selectors.filter(selector => !selector.includes(PLANNER_SCOPE)));
  });
  eq(leaks,[],'vendor styles cannot select other plugins: '+path);
  if (path.includes('frappe')) {
   const colors=[];
   postcss.parse(source).walkRules(rule=>{if(rule.selector===':root')rule.walkDecls(decl=>colors.push(decl.prop));});
   eq(colors.filter(name=>!ganttPalette.has(name)),[],'every upstream Gantt palette variable is overridden at the component');
  }
 }
 for (const token of ['--g-text-dark','--g-weekend-highlight-color','--g-row-color','--g-header-background']) {
  eq(ganttPalette.get(token)?.startsWith('var(--'),true,'Gantt uses active theme for '+token);
 }
 for (const token of ['--ec-bg-color','--ec-text-color','--ec-today-bg-color','--ec-event-bg-color','--ec-event-text-color']) {
  eq(calendarPalette.get(token)?.startsWith('var(--'),true,'Calendar overrides its own vendor default for '+token);
 }
 const sample=postcss.parse(scopeVendorStyles('@media print { .gantt:is(.a,.b), .ec {color:red} } @keyframes pulse {from {opacity:0} to {opacity:1}}'));
 const media=sample.nodes[0];
 eq(media.nodes[0].selectors.length,2,'functional commas preserve selector boundaries');
 eq(sample.nodes[1].nodes.map(rule=>rule.selector),['from','to'],'keyframes remain valid');
 return results;
}
