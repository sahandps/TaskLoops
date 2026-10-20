import {createSuite} from './harness.mjs';
export default async function run(mod) {
 const {eq,results}=createSuite('theme, week number and progress preferences');
 const defaults=mod.normalizeSettings();
 eq([defaults.theme,defaults.showWeekNumbers,defaults.showProgressBars],['inherit',true,true],'upgrades follow Obsidian and retain existing week numbers');
 const saved=mod.normalizeSettings({theme:'dark',showWeekNumbers:false,showProgressBars:false});
 eq([saved.theme,saved.showWeekNumbers,saved.showProgressBars],['dark',false,false],'saved explicit preferences are retained');
 const invalid=mod.normalizeSettings({theme:'unknown',showWeekNumbers:'false',showProgressBars:null});
 eq([invalid.theme,invalid.showWeekNumbers,invalid.showProgressBars],['inherit',true,true],'invalid stored display preferences fall back safely');
 eq(mod.normalizeSettings({timeSlotHeight:NaN}).timeSlotHeight,24,'invalid saved zoom resets safely');
 eq(mod.normalizeSettings({timeSlotHeight:1000}).timeSlotHeight,80,'stored zoom is bounded');
 const attrs={};const root={setAttribute:(k,v)=>{attrs[k]=v;},removeAttribute:k=>{delete attrs[k];}};
 mod.applyPlannerTheme(root,'light');eq(attrs,{'data-tl-theme':'light'},'light palette is applied to the chosen element only');
 mod.applyPlannerTheme(root,'dark');eq(attrs,{'data-tl-theme':'dark'},'dark palette updates the same scope');
 mod.applyPlannerTheme(root,'inherit');eq(attrs,{},'following Obsidian removes the local override');
 const plugin=new mod.TaskLoopsPlugin();plugin.settings={...defaults};let saves=0,refreshes=0;
 plugin.saveSettings=async()=>{saves++;};plugin.refreshViews=()=>{refreshes++;};
 const defs=new mod.TaskLoopsSettingTab({},plugin).getSettingDefinitions();
 let changed;const component={addOption:()=>component,setValue:()=>component,onChange:fn=>{changed=fn;return component;}};
 defs.find(d=>d.name==='Planner theme').render({addDropdown:fn=>fn(component)});
 await changed('light');eq(plugin.settings.theme,'light','native theme dropdown changes the plugin preference');
 await changed('invalid');eq(plugin.settings.theme,'inherit','theme dropdown guards invalid values');
 for(const [name,key] of [['Show week numbers','showWeekNumbers'],['Show progress bars','showProgressBars']]) {
  defs.find(d=>d.name===name).render({addToggle:fn=>fn(component)});await changed(false);
  eq(plugin.settings[key],false,name+' changes the live preference');
 }
 eq([saves,refreshes],[4,4],'each preference saves through the existing settings record and refreshes views');
 component.setLimits=()=>component;
 defs.find(d=>d.name==='Calendar zoom').render({addSlider:fn=>fn(component)});
 await changed(150);eq(plugin.settings.timeSlotHeight,36,'settings zoom percentage updates calendar slot size');
 eq([saves,refreshes],[5,5],'zoom setting saves and refreshes through the same preference record');
 return results;
}
