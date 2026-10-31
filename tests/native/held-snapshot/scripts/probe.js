import {EquipmentSlot,GameMode,ItemStack,system,world} from '@minecraft/server';
import * as gameTest from '@minecraft/server-gametest';
import {plateHeldVisualPlan,PLATE_HELD_WORD_A_MAX,PLATE_HELD_WORD_B_MAX} from './canonical/plate_held_visual_core.js';
import {configureItemDataWorld,getItemProperty,setItemProperty} from './canonical/core/persist.js';
import {createSnapshotPublisher,FRAME_PROPERTY} from './snapshot.js';
import {plateRows} from './cases.js';
import {writeHeldVisual} from './canonical/held_visual_transport.js';
import {PROPERTY_CONTROL} from './mode.js';
const TAG='[Grilling snapshot probe]';
const PLATE='kaleidoscope_grilling:skewer_plate',KEY='kaleidoscope_grilling:plate_skewers';
const snapshots=createSnapshotPublisher(),actors=new Map();
const publisher={...snapshots,publish(player,main,off){
 if(PROPERTY_CONTROL){
  for(const [hand,values] of [['main',main],['off',off]])writeHeldVisual(player,hand,values[11]===255?'plate':'empty',values);
 }
 return snapshots.publish(player,main,off);
}};
const emit=value=>console.warn(TAG+' '+JSON.stringify(value));
const wait=ticks=>new Promise(resolve=>system.runTimeout(resolve,ticks));
configureItemDataWorld(world);
function read(player,hand){return player.getComponent('minecraft:equippable').getEquipment(hand==='main'?EquipmentSlot.Mainhand:EquipmentSlot.Offhand);}
function words(player,hand){
 const item=read(player,hand);
 return item?.typeId===PLATE?plateHeldVisualPlan(JSON.parse(getItemProperty(item,KEY)??'[]'),system.currentTick):Array(12).fill(0);
}
function seed(player,variant=0){
 const equipment=player.getComponent('minecraft:equippable');
 for(const [i,slot] of [EquipmentSlot.Mainhand,EquipmentSlot.Offhand].entries()){
  const item=new ItemStack(PLATE,1);item.nameTag='Snapshot '+(variant+i);
  setItemProperty(item,KEY,JSON.stringify(plateRows(variant+i)));equipment.setEquipment(slot,item);
 }
 actors.set(player.id,{player,variant});
 publisher.publish(player,words(player,'main'),words(player,'off'));
 emit({kind:'seed',variant,mainRows:5,offRows:5});
}
async function native(){
 const players=[];
 try{
  const dimension=world.getDimension('overworld');
  for(let n=0;n<40;n++){
   let loaded=false;try{loaded=!!dimension.getBlock({x:2,y:79,z:66});}catch{}
   if(loaded)break;await wait(5);
  }
  for(const x of [2,5])dimension.getBlock({x,y:79,z:66}).setType('minecraft:stone');
  const owner=gameTest.spawnSimulatedPlayer({dimension,x:2.5,y:80,z:66.5},'SnapshotOwner',GameMode.Survival);players.push(owner);
  const viewer=gameTest.spawnSimulatedPlayer({dimension,x:5.5,y:80,z:66.5},'SnapshotViewer',GameMode.Survival);players.push(viewer);
  seed(owner,0);await wait(2);
  const a=words(owner,'main'),b=words(owner,'off');
  if(a[10]!==5||b[10]!==5||a[11]!==255||b[11]!==255||JSON.stringify(a)===JSON.stringify(b))throw Error('Invalid distinct dual full-plate input');
  if(publisher.publish(owner,a,b)!==false)throw Error('Unchanged data resent');
  const first=owner.getProperty(FRAME_PROPERTY);
  seed(owner,2);await wait(2);
  const second=owner.getProperty(FRAME_PROPERTY);if(!(second>first))throw Error('Same-ID changed contents did not advance snapshot');
  if(!publisher.replay(owner,[viewer]))throw Error('Observer-specific replay not submitted');
  actors.delete(owner.id);
  const maxima=Array.from({length:5},()=>[PLATE_HELD_WORD_A_MAX,PLATE_HELD_WORD_B_MAX]).flat().concat([5,255]);
  publisher.publish(owner,maxima,maxima);await wait(2);
  const maximum=owner.getProperty(FRAME_PROPERTY);
  publisher.publish(owner,Array(12).fill(0),Array(12).fill(0));await wait(2);
  emit({kind:'result',ok:true,apiAccepted:true,distinctDualFullPlates:true,sameIdSwap:true,unchangedSuppressed:true,observerReplayAccepted:true,maximumPayloadAccepted:true,frames:[first,second,maximum,owner.getProperty(FRAME_PROPERTY)],clientEvaluated:false,channelViable:null});
 }catch(error){emit({kind:'result',ok:false,reason:String(error),clientEvaluated:false,channelViable:null});}
 finally{for(const player of players){actors.delete(player.id);publisher.forget(player.id);try{player.disconnect();}catch{}}}
}
system.afterEvents.scriptEventReceive.subscribe(event=>{
 if(event.id==='kg_snapshot_probe:native'){void native();return;}
 const player=event.sourceEntity;if(player?.typeId!=='minecraft:player')return;
 if(event.id==='kg_snapshot_probe:seed')seed(player,Number(event.message)||0);
 if(event.id==='kg_snapshot_probe:swap')seed(player,(actors.get(player.id)?.variant??0)+2);
 if(event.id==='kg_snapshot_probe:replay')for(const actor of actors.values())publisher.replay(actor.player,[player]);
 if(event.id==='kg_snapshot_probe:clear')publisher.publish(player,Array(12).fill(0),Array(12).fill(0));
});
function resume(player){
 if(!player.isValid)return;
 if(['main','off'].some(hand=>read(player,hand)?.typeId===PLATE)){
  actors.set(player.id,{player,variant:0});
  publisher.publish(player,words(player,'main'),words(player,'off'));
 }
 for(const actor of actors.values())if(actor.player.isValid&&actor.player.dimension.id===player.dimension.id)publisher.replay(actor.player,[player]);
 if(actors.has(player.id))publisher.replay(player,world.getAllPlayers().filter(viewer=>viewer.id!==player.id&&viewer.dimension.id===player.dimension.id));
}
world.afterEvents.playerSpawn.subscribe(({player})=>system.runTimeout(()=>resume(player),2));
world.afterEvents.playerDimensionChange.subscribe(({player})=>system.runTimeout(()=>resume(player),2));
system.run(()=>{for(const player of world.getAllPlayers())resume(player);});
world.afterEvents.playerLeave.subscribe(({playerId})=>{actors.delete(playerId);publisher.forget(playerId);});
// Test-world polling only. The production migration must use its existing
// dispatcher and a measured visibility/re-entry strategy; this is not that gate.
system.runInterval(()=>{
 for(const actor of actors.values())try{
  if(actor.player.isValid)publisher.publish(actor.player,words(actor.player,'main'),words(actor.player,'off'));
 }catch(error){emit({kind:'sample_error',error:String(error)});}
},5);
