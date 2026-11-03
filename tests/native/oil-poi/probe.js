// Isolated diagnostic entry only. Import beside unchanged production scripts.
import {world,system,ItemStack,GameMode,Direction} from '@minecraft/server';
import {spawnSimulatedPlayer} from '@minecraft/server-gametest';
import {a26ReadPress,a26ReadVat,a26ProbePressContainer} from './oil/oil_machine_runtime.js';
import {PERSISTED_KEY as Keys} from './core/persist_keys.js';
const prefix='[S1_OIL_POI] ', N='kaleidoscope_grilling:';
const emit=(kind,row={})=>console.log(prefix+JSON.stringify({kind,...row}));
const wait=ticks=>new Promise(resolve=>system.runTimeout(resolve,ticks));
const check=(value,message)=>{if(!value)throw Error(message)};
const point={x:8,y:64,z:8},vatPoint={x:4,y:64,z:4},laterPoint={x:9,y:64,z:8};
const encoded=n=>n<0?'m'+Math.abs(n):'p'+n;
const key=(prefix,block)=>prefix+block.dimension.id.replace(/[^a-z0-9]/gi,'_')+'_'+encoded(block.x)+'_'+encoded(block.y)+'_'+encoded(block.z);
const marker='senluo_s1:oil_stage';
let player,dimension;
let interactionEvents=0;
world.beforeEvents.playerInteractWithBlock.subscribe(event=>{
 if(event.block.typeId===N+'oil_press'||event.block.typeId===N+'big_vat'||event.block.typeId==='minecraft:chest'){
  interactionEvents++;
  emit('native_interaction',{events:interactionEvents,block:event.block.typeId,first:event.isFirstEvent,cancelled:event.cancel,item:event.itemStack?.typeId??null});
 }
});
const inventory=()=>player.getComponent('minecraft:inventory').container;
const residues=()=>dimension.getEntities({type:'minecraft:item'}).reduce((sum,e)=>{
 const item=e.getComponent('minecraft:item')?.itemStack;return sum+(item?.typeId===N+'oil_residue'?item.amount:0);
},0)+Array.from({length:inventory().size},(_,i)=>inventory().getItem(i)).reduce((sum,item)=>sum+(item?.typeId===N+'oil_residue'?item.amount:0),0);
async function interact(block,item){
 inventory().setItem(0,item);player.selectedSlotIndex=0;await wait(2);
 const accepted=inventory().getItem(0)?player.useItemInSlotOnBlock(0,block.location,Direction.Up,{x:.5,y:1,z:.5}):player.interactWithBlock(block.location,Direction.Up);await wait(1);player.stopInteracting();
 await wait(12);emit('interaction_return',{accepted,events:interactionEvents});return accepted;
}
async function loadBatch(press){
 inventory().setItem(0,new ItemStack(N+'oil_cake',4));player.selectedSlotIndex=0;
 for(let i=0;i<4;i++){
  await wait(2);const accepted=player.useItemInSlotOnBlock(0,press.location,Direction.Up,{x:.5,y:1,z:.5});await wait(1);player.stopInteracting();await wait(12);emit('cake_attempt',{index:i,accepted,events:interactionEvents,state:a26ReadPress(press),hand:inventory().getItem(0)?.amount??0});
 }
 const state=a26ReadPress(press);check(state.cakes===4&&inventory().getItem(0)===undefined,'native cake debit failed: '+JSON.stringify(state));
 emit('native_cakes',{state,handEmpty:true});
}
async function pressBatch(press){
 for(let i=0;i<4;i++){
  await interact(press,new ItemStack('minecraft:anvil'));await wait(12);
 }
 await wait(15);
}
async function run(){
 try{
  check(world.getAllPlayers().length===0,'unexpected player before diagnostic');
  dimension=world.getDimension('overworld');
  try{dimension.runCommand('tickingarea remove s1_oil_probe')}catch{}
  dimension.runCommand('tickingarea add 0 64 0 31 64 15 s1_oil_probe true');
  for(let i=0;i<40;i++){try{if(dimension.getBlock(point))break}catch{}await wait(5)}
  check(dimension.getBlock(point),'probe chunk unavailable');
  dimension.runCommand('gamerule doMobSpawning false');
  dimension.runCommand('fill 1 63 1 18 63 13 minecraft:stone');
  player=spawnSimulatedPlayer({dimension,x:8.5,y:64,z:10.5},'S1OilProbe',GameMode.Survival);
  const press=dimension.getBlock(point),vat=dimension.getBlock(vatPoint),later=dimension.getBlock(laterPoint);
  const chest=dimension.getBlock({x:8,y:64,z:12});chest.setType('minecraft:chest');
  const chestAccepted=player.interactWithBlock(chest.location,Direction.Up);await wait(2);player.stopInteracting();
  emit('native_chest_control',{accepted:chestAccepted,events:interactionEvents,player:player.location,press:press.location});
  chest.setType('minecraft:air');
  if(world.getDynamicProperty(marker)==='restart_pending'){
   const before={press:a26ReadPress(press),vat:a26ReadVat(vat),raw:world.getDynamicProperty(key(Keys.A26_PRESS_PREFIX,press))};
   check(before.press.cakes===4&&before.press.waiting&&before.vat.buckets===8,'restart lost waiting batch');
   world.setDynamicProperty(key(Keys.A26_VAT_PREFIX,vat),JSON.stringify({type:'',buckets:0}));
   await interact(press,new ItemStack('minecraft:anvil'));await wait(8);
   const after={press:a26ReadPress(press),vat:a26ReadVat(vat),residue:residues()};
   check(after.press.cakes===0&&after.vat.buckets===4&&after.residue===4,'restart delivery failed');
   await interact(press,new ItemStack('minecraft:anvil'));await wait(25);
   check(a26ReadVat(vat).buckets===4&&residues()===4,'restart duplicate delivery');
   emit('restart_delivery',{before,after,duplicateAfterRetry:false});
   world.setDynamicProperty(marker,'complete');
   emit('complete',{stage:2,ok:true,client:false,multiplayer:false});
  }else{
   for(const e of dimension.getEntities({type:'minecraft:item'}))e.remove();
   press.setType(N+'oil_press');vat.setType(N+'big_vat');later.setType(N+'big_vat');
   world.setDynamicProperty(key(Keys.A26_PRESS_PREFIX,press),undefined);
   for(const b of [vat,later])world.setDynamicProperty(key(Keys.A26_VAT_PREFIX,b),undefined);
   await wait(5);
   const chosen=a26ProbePressContainer(press);
   check(chosen.status==='SUCCESS'&&chosen.block?.x===vat.x&&chosen.block?.z===vat.z,'native POI Java order mismatch');
   emit('native_poi_order',{status:chosen.status,selected:chosen.block.location,later:later.location});
   await loadBatch(press);await pressBatch(press);
   const completed={press:a26ReadPress(press),firstVat:a26ReadVat(vat),laterVat:a26ReadVat(later),residue:residues()};
   check(completed.press.cakes===0&&completed.firstVat.buckets===4&&completed.laterVat.buckets===0&&completed.residue===4,'native full transaction failed: '+JSON.stringify(completed));
   await interact(press,new ItemStack('minecraft:anvil'));await wait(25);
   check(a26ReadVat(vat).buckets===4&&residues()===4,'completed batch repeated');
   emit('native_completion',{...completed,duplicateAfterRetry:false});
   // A real malformed persisted value must be rejected, not read as an empty vat.
   const saved=world.getDynamicProperty(key(Keys.A26_VAT_PREFIX,vat));
   world.setDynamicProperty(key(Keys.A26_VAT_PREFIX,vat),'{malformed');
   let rejected=false;try{a26ProbePressContainer(press)}catch{rejected=true}
   check(rejected&&world.getDynamicProperty(key(Keys.A26_VAT_PREFIX,vat))==='{malformed','corrupt vat overwritten');
   world.setDynamicProperty(key(Keys.A26_VAT_PREFIX,vat),saved);
   emit('corrupt_vat',{rejected,originalMalformedPreserved:true,recovered:a26ReadVat(vat)});
   // Isolated setup makes only one full vat eligible; keep its waiting batch for restart.
   later.setType('minecraft:air');
   world.setDynamicProperty(key(Keys.A26_VAT_PREFIX,vat),JSON.stringify({type:'canola',buckets:8}));
   for(const e of dimension.getEntities({type:'minecraft:item'}))e.remove();
   for(let slot=0;slot<inventory().size;slot++)inventory().setItem(slot,undefined);
   await loadBatch(press);await pressBatch(press);
   const pending={press:a26ReadPress(press),vat:a26ReadVat(vat),residue:residues()};
   check(pending.press.cakes===4&&pending.press.waiting&&pending.vat.buckets===8&&pending.residue===0,'full vat did not preserve batch');
   world.setDynamicProperty(marker,'restart_pending');
   emit('complete',{stage:1,ok:true,pending,client:false,multiplayer:false});
  }
 }catch(error){emit('failure',{error:String(error),stack:error?.stack??null,client:false})}
 finally{if(player)try{player.disconnect()}catch{};emit('disconnected',{players:world.getAllPlayers().length})}
}
world.afterEvents.worldLoad.subscribe(()=>system.runTimeout(()=>{void run()},10));
