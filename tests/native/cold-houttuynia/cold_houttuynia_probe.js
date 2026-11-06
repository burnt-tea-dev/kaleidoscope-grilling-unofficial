// Diagnostic entry: real crafting owner with native Players and ItemStacks.
import {world,system,ItemStack,GameMode,EquipmentSlot} from '@minecraft/server';
import {spawnSimulatedPlayer} from '@minecraft/server-gametest';
import {configureItemDataWorld,setItemProperty,getItemProperty} from './core/persist.js';
import {tryCraftColdHouttuynia} from './food/cold_houttuynia_runtime.js';
import {buildCookeryOilPot,readCookeryOilPot} from './oil/cookery_oil_pot_adapter.js';
import {captureSkewerMetadata} from './skewer_item_snapshot.js';
import './world/houttuynia_crop_runtime.js';
configureItemDataWorld(world);
const N='kaleidoscope_grilling:',ROOT=N+'houttuynia',COLD=N+'cold_houttuynia';
const KEY='grilling_qa:cold_expected',DATA='grilling_qa:original_batch';
const wait=n=>new Promise(resolve=>system.runTimeout(resolve,n));
let started=false;
const snapshot=stack=>stack?{amount:stack.amount,native:captureSkewerMetadata(stack)}:null;
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
system.afterEvents.scriptEventReceive.subscribe(event=>{
 if(event.id!=='grilling_qa:cold_houttuynia'||started)return;
 started=true;run(event.message).catch(error=>console.error('GRILLING_QA_FATAL '+error+' '+error?.stack));
});
async function run(phase){
 const dimension=world.getDimension('overworld'),checks=[],samples=[];
 const check=(name,passed)=>{checks.push({name,passed:!!passed});console.warn('GRILLING_QA_CHECK '+JSON.stringify(checks.at(-1)))};
 check('isolated QA has no external Players',world.getAllPlayers().length===0);
 if(world.getAllPlayers().length)throw Error('external Players');
 let player;
 try{
  if(phase==='write'){
   dimension.runCommand('fill -2 79 -2 2 79 2 stone');
   dimension.runCommand('fill -2 80 -2 2 84 2 air');
   dimension.getBlock({x:1,y:80,z:1}).setType('minecraft:chest');
   player=spawnSimulatedPlayer({dimension,x:.5,y:80,z:.5},'ColdCraftNative',GameMode.Survival);
   player.isSneaking=true;await wait(2);
   const bag=player.getComponent('minecraft:inventory').container,equipment=player.getComponent('minecraft:equippable');
   const chest=dimension.getBlock({x:1,y:80,z:1}).getComponent('minecraft:inventory').container;
   const expected=[];
   for(const [index,roots,oil,full] of [[0,6,4,false],[1,3,2,true],[2,6,4,true]]){
    bag.clearAll();player.selectedSlotIndex=0;
    const root=new ItemStack(ROOT,roots);root.nameTag='Native original roots';root.setLore([{text:'Original root lore'}]);
    setItemProperty(root,DATA,'root-batch');
    const template=new ItemStack('kaleidoscope_cookery:oil_pot_filled');
    template.nameTag='Native original oil pot';template.setLore([{text:'Original pot lore'}]);template.keepOnDeath=true;
    setItemProperty(template,DATA,'pot-batch');
    const pot=buildCookeryOilPot('premium_chili',oil,template);
    bag.setItem(0,root);equipment.setEquipment(EquipmentSlot.Offhand,pot);
    if(full)for(let slot=1;slot<bag.size;slot++)bag.setItem(slot,new ItemStack('minecraft:stone',64));
    check('case '+index+' uses native unstackable oil pots',pot.maxAmount===1);
    check('case '+index+' real crafting owner commits once',tryCraftColdHouttuynia(player));
    const main=bag.getItem(0),off=equipment.getEquipment(EquipmentSlot.Offhand);
    const dishes=[];
    for(let slot=0;slot<bag.size;slot++){const stack=bag.getItem(slot);if(stack?.typeId===COLD)dishes.push(stack)}
    const drops=dimension.getEntities({type:'minecraft:item'}).filter(entity=>entity.getComponent('minecraft:item')?.itemStack.typeId===COLD);
    for(const entity of drops)dishes.push(entity.getComponent('minecraft:item').itemStack);
    check('case '+index+' creates exactly one cold dish',dishes.reduce((n,stack)=>n+stack.amount,0)===1);
    check('case '+index+' consumes three roots or reuses their freed main slot',roots===3?main?.typeId===COLD:main?.typeId===ROOT&&main.amount===roots-3&&getItemProperty(main,DATA)==='root-batch');
    check('case '+index+' consumes exactly two premium oil points',readCookeryOilPot(off).count===oil-2);
    check('case '+index+' preserves native pot name lore flags and own dynamic data',off.nameTag===template.nameTag&&off.keepOnDeath===true&&getItemProperty(off,DATA)==='pot-batch'&&off.getRawLore().some(row=>row.text==='Original pot lore'));
    if(oil===2)check('exhaustion returns the native empty-pot identity',off.typeId==='kaleidoscope_cookery:oil_pot'&&off.maxAmount===1);
    if(full&&roots>3)check('full inventory produces one native drop',drops.length===1);
    if(full)check('all unrelated native stacks stay unchanged',Array.from({length:bag.size-1},(_,i)=>bag.getItem(i+1)).every(stack=>stack?.typeId==='minecraft:stone'&&stack.amount===64));
    const saved=[main,off,dishes[0]];
    for(let i=0;i<saved.length;i++){chest.setItem(index*3+i,saved[i]);expected.push(snapshot(saved[i]))}
    for(const entity of drops)entity.remove();
    samples.push({case:index,roots,oil,full,main:snapshot(main),off:snapshot(off),dish:snapshot(dishes[0])});
   }
   world.setDynamicProperty(KEY,JSON.stringify(expected));
   check('native chest receives exact affected item data',equal(Array.from({length:9},(_,i)=>snapshot(chest.getItem(i))),expected));
  }else if(phase==='reload'){
   const expected=JSON.parse(world.getDynamicProperty(KEY)??'null');
   const chest=dimension.getBlock({x:1,y:80,z:1}).getComponent('minecraft:inventory').container;
   const actual=Array.from({length:9},(_,i)=>snapshot(chest.getItem(i)));
   check('same saved world preserves exact pot and ingredient metadata after normal restart',equal(actual,expected));
   check('the exhausted empty pot retains native dynamic data after restart',getItemProperty(chest.getItem(4),DATA)==='pot-batch');
   samples.push({expected,actual});
  }else throw Error('unknown phase '+phase);
 }finally{if(player){player.disconnect();await wait(2)}}
 check('all native Players disconnected',world.getAllPlayers().length===0);
 console.warn('GRILLING_QA_RESULT '+JSON.stringify({passed:checks.every(row=>row.passed),phase,checks,samples,playersAfter:world.getAllPlayers().length,
  scope:'Real tryCraftColdHouttuynia owner, native inventory/offhand/drop and same QA saved-world reload. Minimal external Cookery pot content supplies original IDs/max-stack/allow-offhand; no author component interaction, actual sneak-click input, full family, natural API failure or client claim.'}));
}
