// Diagnostic entry. Exercise the real lore cache and registered inventory queue.
import {world,system,ItemStack,GameMode} from '@minecraft/server';
import {spawnSimulatedPlayer} from '@minecraft/server-gametest';
import {configureItemDataWorld,getItemProperty,getItemPropertyIds,setItemProperty} from './core/persist.js';
import {needsSecretGuiCache,refreshSecretGuiCache} from './secret_gui_state.js';
import {SECRET_GUI_HEADER,SECRET_GUI_PROGRESS,secretGuiProgress,decodeSecretGuiCache} from './secret_gui_core.js';
import {SECRET_VISUAL_SLOTS} from './secret_visual_catalog.js';
import './hot_lore_runtime.js';
configureItemDataWorld(world);
const wait=n=>new Promise(resolve=>system.runTimeout(resolve,n));
const expectedKey='grilling_qa:secret_gui_expected',events=[];
let started=false;
world.afterEvents.playerInventoryItemChange.subscribe(e=>events.push({slot:e.slot,tick:system.currentTick}));
system.afterEvents.scriptEventReceive.subscribe(event=>{
 if(event.id!=='grilling_qa:secret_gui'||started)return;
 started=true;run(event.message).catch(error=>console.error('GRILLING_QA_FATAL '+error+' '+error?.stack));
});
function snapshot(stack){
 return {id:stack.typeId,amount:stack.amount,max:stack.maxAmount,name:stack.nameTag,
  keepOnDeath:stack.keepOnDeath,rawLore:stack.getRawLore(),
  properties:Object.fromEntries(getItemPropertyIds(stack).sort().map(key=>[key,getItemProperty(stack,key)]))};
}
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function cache(stack){return stack.getRawLore().map(secretGuiProgress).find(x=>x?.cache)?.cache}
function secret(foods,variants,cooked){
 const stack=new ItemStack('kaleidoscope_grilling:secret_skewer',3);
 stack.nameTag='Native GUI '+foods.join('/');stack.keepOnDeath=true;
 stack.setLore([{text:'§aForeign original lore'},{translate:SECRET_GUI_PROGRESS,with:['3','3']},
  {rawtext:[{text:'Original '},{translate:'item.apple.name'}]}]);
 setItemProperty(stack,'kaleidoscope_grilling:skewer_ingredients',JSON.stringify(foods.map(id=>({id}))));
 setItemProperty(stack,'kaleidoscope_grilling:model_variants',JSON.stringify(variants));
 if(cooked){
  setItemProperty(stack,'kaleidoscope_grilling:secret_cooked',true);
  setItemProperty(stack,'kaleidoscope_grilling:secret_cooked_ingredients',JSON.stringify(cooked.map(id=>({id}))));
 }
 return stack;
}
async function run(phase){
 const dimension=world.getDimension('overworld'),checks=[],samples=[];
 const check=(name,passed)=>{checks.push({name,passed:!!passed});console.warn('GRILLING_QA_CHECK '+JSON.stringify(checks.at(-1)))};
 check('isolated QA has no external Players',world.getAllPlayers().length===0);
 if(world.getAllPlayers().length)throw Error('external players');
 let player;
 try{
  if(phase==='write'){
   dimension.runCommand('fill -2 79 -2 2 79 2 stone');
   dimension.runCommand('fill -2 80 -2 2 84 2 air');
   dimension.getBlock({x:1,y:80,z:1}).setType('minecraft:chest');
   const recipes=[['minecraft:apple','minecraft:carrot','minecraft:beef'],['minecraft:beef','minecraft:apple','minecraft:carrot']];
   const cooked=['minecraft:cooked_beef','minecraft:baked_potato','minecraft:golden_carrot'];
   const stacks=[secret(recipes[0],[4,7,9]),secret(recipes[1],[4,7,9]),secret(recipes[0],[7,4,7],cooked)];
   const before=stacks.map(snapshot);
   // Test the API directly before the event queue, including RawMessage retention.
   const direct=stacks[0].clone();let error;
   try{refreshSecretGuiCache(direct)}catch(cause){error=String(cause)}
   const encoded=cache(direct);
   samples.push({directSetLoreError:error??null,formatCodeUnits:encoded?.length??0,rawLore:direct.getRawLore()});
   check('actual setLore accepts the complete formatting cache',!error&&encoded?.startsWith(SECRET_GUI_HEADER)&&encoded.length===98);
   check('actual getRawLore keeps the wrapped progress and complete decoded cache',equal(decodeSecretGuiCache(encoded),{foods:recipes[0].map(id=>SECRET_VISUAL_SLOTS[id]),variants:6,style:0}));
   check('native readback is stable for needsSecretGuiCache',!needsSecretGuiCache(direct));
   if(error||!encoded)throw Error('native lore cache encoding failed: '+error);
   const directBefore=direct.getRawLore();refreshSecretGuiCache(direct);
   check('a second refresh leaves native lore unchanged',equal(direct.getRawLore(),directBefore));
   player=spawnSimulatedPlayer({dimension,x:.5,y:80,z:.5},'SecretGuiNative',GameMode.Survival);
   player.selectedSlotIndex=8;await wait(3);
   const bag=player.getComponent('minecraft:inventory').container;
   for(let slot=0;slot<3;slot++)bag.setItem(slot,stacks[slot]);
   await wait(8);
   const results=[0,1,2].map(slot=>bag.getItem(slot)),after=results.map(snapshot);
   for(let slot=0;slot<3;slot++){
    check('slot '+slot+' emits a real native inventory change',events.some(e=>e.slot===slot));
    check('slot '+slot+' has its own expected cache',equal(decodeSecretGuiCache(cache(results[slot])),
     {foods:(slot===2?cooked:recipes[slot]).map(id=>SECRET_VISUAL_SLOTS[id]),variants:slot===2?5:6,style:slot===2?6:0}));
    const original=before[slot],current=after[slot];
    check('slot '+slot+' preserves ID count name flags and all gameplay properties',equal({...current,rawLore:undefined},{...original,rawLore:undefined}));
    const base=current.rawLore.map(row=>secretGuiProgress(row)?.base??row);
    check('slot '+slot+' preserves every original lore row including the private carrier',original.rawLore.every(row=>base.some(value=>equal(row,value))));
    check('slot '+slot+' native cached stack no longer needs a refresh',!needsSecretGuiCache(results[slot]));
   }
   await wait(25);
   check('the registered queue stops rewriting unchanged cold stacks',equal([0,1,2].map(slot=>snapshot(bag.getItem(slot))),after));
   bag.setItem(0,results[1]);bag.setItem(1,results[0]);await wait(4);
   check('reordering two same-ID native inventory stacks preserves their independent data',equal(snapshot(bag.getItem(0)),after[1])&&equal(snapshot(bag.getItem(1)),after[0]));
   const chest=dimension.getBlock({x:1,y:80,z:1}).getComponent('minecraft:inventory').container;
   const saved=[1,0,2].map(slot=>bag.getItem(slot));
   for(let slot=0;slot<3;slot++){chest.setItem(slot,saved[slot]);bag.setItem([1,0,2][slot],undefined)}
   const expected=saved.map(snapshot);world.setDynamicProperty(expectedKey,JSON.stringify(expected));
   check('native chest transfer preserves exact cached item data',equal([0,1,2].map(slot=>snapshot(chest.getItem(slot))),expected));
   samples.push({before,after,events});
  }else if(phase==='reload'){
   const expected=JSON.parse(world.getDynamicProperty(expectedKey)??'null');
   const chest=dimension.getBlock({x:1,y:80,z:1}).getComponent('minecraft:inventory').container;
   const stacks=[0,1,2].map(slot=>chest.getItem(slot)),actual=stacks.map(snapshot);
   check('same saved world keeps exact lore metadata name count and flags after restart',equal(actual,expected));
   for(let slot=0;slot<3;slot++)check('reloaded slot '+slot+' keeps a stable native cache',!!decodeSecretGuiCache(cache(stacks[slot]))&&!needsSecretGuiCache(stacks[slot]));
   samples.push({expected,actual});
  }else throw Error('unknown phase '+phase);
 }finally{if(player){player.disconnect();await wait(2)}}
 check('all native Players disconnected',world.getAllPlayers().length===0);
 console.warn('GRILLING_QA_RESULT '+JSON.stringify({passed:checks.every(x=>x.passed),phase,checks,samples,playersAfter:world.getAllPlayers().length,
  scope:'Actual ItemStack lore API, registered inventory cache queue, native chest transfer, and same saved-world restart. No client JSONUI binding or rendering claim; LIVE unchanged.'}));
}
