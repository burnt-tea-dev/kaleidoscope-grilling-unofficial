// Isolated test only; loaded beside the unchanged production main.js.
import {world,system,ItemStack,GameMode} from '@minecraft/server';
import {spawnSimulatedPlayer} from '@minecraft/server-gametest';
import {getItemProperty,getItemRawLore,setItemLore,setItemProperty} from './core/persist.js';
import {setFoodSeasonings,readFoodSeasonings} from './food/food_state_adapter.js';
import {SEASONING_USES_KEY,SEASONING_VARIANT_KEY} from './seasoning/seasoning_contract_core.js';
import {isOwnedBottleLore,isOwnedSeasoningUsesLore,bottleLoreSignature} from './bottle_lore_core.js';
import {seasoningLore} from './localized_lore_core.js';
import {captureSkewerMetadata,metadataSignature} from './skewer_item_snapshot.js';
const PREFIX='[GRILLING_SEASONING_METADATA] ',N='kaleidoscope_grilling:',KEY='grilling_probe:seasoning_metadata';
const ingredients=[N+'green_chili_powder',N+'sichuan_pepper',N+'onion_powder'];
const emit=(kind,row={})=>console.log(PREFIX+JSON.stringify({kind,...row}));
const wait=ticks=>new Promise(resolve=>system.runTimeout(resolve,ticks));
const check=(value,message)=>{if(!value)throw Error(message)};
const foreignLore=stack=>getItemRawLore(stack).filter(line=>!isOwnedBottleLore(line)&&!isOwnedSeasoningUsesLore(line));
const envelope=stack=>({amount:stack.amount,name:stack.nameTag,keepOnDeath:stack.keepOnDeath,lockMode:stack.lockMode,
 canDestroy:stack.getCanDestroy(),canPlaceOn:stack.getCanPlaceOn(),foreign:getItemProperty(stack,'thirdparty:owner'),foreignLore:bottleLoreSignature(foreignLore(stack))});
let player;
for(const event of ['itemStartUse','itemCompleteUse','itemStopUse'])world.afterEvents[event].subscribe(e=>{
 if(e.source.id===player?.id)emit('native_event',{event,tick:system.currentTick,id:e.itemStack?.typeId,useDuration:e.useDuration});
});
system.runTimeout(async()=>{
 try{
  check(world.getAllPlayers().length===0,'unexpected player');
  const dimension=world.getDimension('overworld'),point={x:8,y:64,z:8};
  try{dimension.runCommand('tickingarea add 0 64 0 15 64 15 seasoning_metadata_probe true')}catch{}
  for(let i=0;i<40;i++){try{if(dimension.getBlock(point))break}catch{}await wait(5)}
  const saved=world.getDynamicProperty(KEY);
  if(saved){
   const expected=JSON.parse(saved),chest=dimension.getBlock(point).getComponent('minecraft:inventory').container;
   const restored=chest.getItem(0);check(restored,'saved completed bottle missing');
   check(metadataSignature(captureSkewerMetadata(restored))===expected.signature,'completed bottle metadata changed on restart');
   check(JSON.stringify(envelope(restored))===JSON.stringify(expected.envelope),'public metadata changed on restart');
   check(JSON.stringify(readFoodSeasonings(restored))===JSON.stringify(ingredients),'saved ingredients changed');
   check(getItemProperty(restored,SEASONING_USES_KEY)===0,'saved uses changed');
   emit('complete',{stage:2,ok:true,id:restored.typeId,envelope:envelope(restored),uses:0,variant:getItemProperty(restored,SEASONING_VARIANT_KEY)});return;
  }
  dimension.runCommand('gamerule doMobSpawning false');
  dimension.runCommand('fill 0 63 0 15 63 15 minecraft:stone');
  const chestBlock=dimension.getBlock(point);chestBlock.setType('minecraft:chest');
  const chest=chestBlock.getComponent('minecraft:inventory').container;
  player=spawnSimulatedPlayer({dimension,x:8.5,y:64,z:11.5},'SeasoningMetadataProbe',GameMode.Survival);
  const stack=new ItemStack(N+'pending_seasoning_f3');stack.nameTag='Retained bottle';stack.keepOnDeath=true;stack.lockMode='inventory';
  stack.setCanDestroy(['minecraft:glass']);stack.setCanPlaceOn(['minecraft:stone']);
  setItemProperty(stack,'thirdparty:owner','retained');setFoodSeasonings(stack,ingredients);
  setItemProperty(stack,SEASONING_USES_KEY,9);setItemProperty(stack,SEASONING_VARIANT_KEY,1);
  setItemLore(stack,[{text:'Foreign bottle note'},{translate:'item.apple.name'},...seasoningLore(undefined,ingredients.length,{pending:true})]);
  const before=envelope(stack),inventory=player.getComponent('minecraft:inventory').container;
  inventory.setItem(0,stack);player.selectedSlotIndex=0;await wait(3);
  const accepted=player.useItemInSlot(0);emit('start',{accepted,before});check(accepted,'native use was rejected');
  let completed;
  for(let i=0;i<60;i++){await wait(2);const current=inventory.getItem(0);if(current?.typeId.startsWith(N+'special_seasoning')){completed=current;break}}
  check(completed,'native 80-tick use did not produce a completed bottle');
  const variant=/^kaleidoscope_grilling:special_seasoning_r8_v([0-7])$/.exec(completed.typeId);
  check(variant,'unexpected completed bottle identity');
  check(JSON.stringify(envelope(completed))===JSON.stringify(before),'completed bottle lost public metadata');
  check(JSON.stringify(readFoodSeasonings(completed))===JSON.stringify(ingredients),'completed ingredients changed');
  check(getItemProperty(completed,SEASONING_USES_KEY)===0,'completed uses did not reset');
  check(getItemProperty(completed,SEASONING_VARIANT_KEY)===Number(variant[1]),'completed variant does not match visual identity');
  const owned=getItemRawLore(completed).filter(line=>isOwnedBottleLore(line)||isOwnedSeasoningUsesLore(line));
  check(bottleLoreSignature(owned)===bottleLoreSignature(seasoningLore(16,ingredients.length)),'owned lore was not refreshed');
  chest.setItem(0,completed);inventory.setItem(0,undefined);
  const stored=chest.getItem(0),record={signature:metadataSignature(captureSkewerMetadata(stored)),envelope:envelope(stored)};
  world.setDynamicProperty(KEY,JSON.stringify(record));
  emit('complete',{stage:1,ok:true,id:stored.typeId,envelope:record.envelope,uses:0,variant:getItemProperty(stored,SEASONING_VARIANT_KEY)});
 }catch(error){emit('failure',{error:String(error),stack:error?.stack})}
 finally{
  try{player?.stopUsingItem()}catch{}
  try{player?.disconnect()}catch{}
  await wait(2);emit('disconnected',{players:world.getAllPlayers().length});
 }
},40);
