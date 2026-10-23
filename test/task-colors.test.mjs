import {createSuite} from './harness.mjs';
export default async function run(mod) {
 const {eq,results}=createSuite('nested task color inheritance');
 const root={id:'root',path:'Project.md',color:'#112233'};
 const child={id:'child',path:'Project.md',parentId:'root'};
 const grandchild={id:'grandchild',path:'Project.md',parentId:'child'};
 const sibling={id:'sibling',path:'Project.md',parentId:'root'};
 const tasks=[root,child,grandchild,sibling];
 const colors=mod.taskColorResolver(tasks,{'Project.md':'#778899'});
 eq(colors.color(child),'#112233','child inherits unscheduled parent color');
 eq(colors.color(grandchild),'#112233','inheritance reaches all nesting levels');
 child.color='#bb3344';
 eq(colors.color(child),'#bb3344','subtask can override its own color');
 eq(colors.color(grandchild),'#bb3344','grandchild inherits nearest custom color');
 eq(colors.color(sibling),'#112233','override leaves sibling colors unchanged');
 root.color='#223344';
 eq(colors.color(sibling),'#223344','changing parent updates inheriting children');
 eq(colors.color(grandchild),'#bb3344','changing parent preserves overridden subtree');
 child.color='';
 eq(colors.color(grandchild),'#223344','resetting override restores inheritance through subtree');
 root.color='';
 eq(colors.color(grandchild),'#778899','project color applies without explicit ancestor colors');
 eq(mod.taskColorResolver([child]).color(child),undefined,'missing parent falls back safely');
 root.parentId='grandchild';
 eq(colors.color(child),'#778899','cyclic hierarchy terminates and falls back to project');
 eq(mod.taskColorResolver(tasks).inherited(child),undefined,'project fallback is distinct from an explicit parent color');
 return results;
}
