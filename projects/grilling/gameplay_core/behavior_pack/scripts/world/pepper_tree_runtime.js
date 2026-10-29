import {PERSISTED_KEY as PersistedKey} from '../core/persist_keys.js';
import {onBeforeBlockBreak} from '../core/events.js';
import {every,onlinePlayers} from '../core/scheduler.js';
import {PepperContactWork} from '../pepper_contact_work.js';
import {world,system,ItemStack,BlockPermutation} from '@minecraft/server';
import {getMainHand,getOffHand,setHand,isCreative} from '../core/player_io.js';
import {registerPlantFertilizer,interactWithPlantFertilizer,plantMutationAllowed,commitPlantSteps,samePlantPermutation} from '../plant_fertilizer.js';
import {
 PEPPER_LOG_ID,PEPPER_LEAVES_ID,PEPPER_SAPLING_ID,SICHUAN_PEPPER_ID,PEPPER_WORLDGEN_SEED_ID,
 LEAVES_COMPONENT_ID,SAPLING_COMPONENT_ID,LOG_COMPONENT_ID,
 HAS_PEPPER_STATE,PERSISTENT_STATE,SAPLING_STAGE_STATE,LEAF_DECAY_DISTANCE,STING_INTERVAL_TICKS,
 shouldFruitPepperLeaf,harvestedPepperCount,saplingBonemealSucceeds,saplingRandomTickSucceeds,
 nextSaplingAction,pepperTreeHeight,pepperLogAxis,pepperLeafBreakPlan,pepperTreePlan
} from './pepper_tree_core.js';
import {awardMountainFragrance} from '../advancement/advancement_runtime.js';
import {createOwnedPlantWrite,plantFertilizerSteps} from '../plant_fertilizer_transaction_core.js';

const STING_UNTIL=PersistedKey.PEPPER_STING_UNTIL;
const REPLACEABLE=new Set(['minecraft:air','minecraft:short_grass','minecraft:tall_grass','minecraft:snow_layer','minecraft:vine']);
const AXES=new Set(['minecraft:wooden_axe','minecraft:stone_axe','minecraft:iron_axe','minecraft:golden_axe','minecraft:diamond_axe','minecraft:netherite_axe']);
const DIRS=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const pepperContacts=new PepperContactWork(),recoveredContactDimensions=new Set(),contactCensus=new Map();
let contactWarning=-1200;
function rememberPepperContact(block){
 const dimension=block.dimension,d=dimension.id;
 pepperContacts.rememberLeaf(d,block.location,system.currentTick);
 if(recoveredContactDimensions.has(d))return;
 // First loaded leaf heartbeat recovers existing entities after script reload.
 // No pepper source means no dimension census; this is never a recurring scan.
 recoveredContactDimensions.add(d);
 contactCensus.set(d,dimension);
}
function contactError(error){if(system.currentTick-contactWarning>=1200){contactWarning=system.currentTick;console.warn('[Grilling pepper contact] '+error);}}

function at(d,loc,dx=0,dy=0,dz=0){
 try{return d.getBlock({x:loc.x+dx,y:loc.y+dy,z:loc.z+dz})}catch{return undefined}
}
function state(block,key,fallback){
 try{const v=block?.permutation?.getState(key);return v===undefined?fallback:v}catch{return fallback}
}
function setState(block,key,value){
 try{block.setPermutation(block.permutation.withState(key,value));return true}catch{return false}
}
function harvestPepper(block){
 if(!block||block.typeId!==PEPPER_LEAVES_ID||!plantMutationAllowed(block))return false;
 const before=block.permutation;
 if(before.getState(HAS_PEPPER_STATE)!==true)return false;
 const clear=createOwnedPlantWrite({
  read:()=>block.permutation,write:value=>block.setPermutation(value),
  same:samePlantPermutation,before,after:before.withState(HAS_PEPPER_STATE,false)
 });
 const count=harvestedPepperCount(Math.random()),tileDrops=world.gameRules.doTileDrops,drops=[];
 if(typeof tileDrops!=='boolean')throw Error('Pepper harvest game rule unavailable');
 if(tileDrops){
  const stack=new ItemStack(SICHUAN_PEPPER_ID,count);
  let entityId,attempted=false,acknowledged=false;
  const owned=entity=>{
   const item=entity?.getComponent('minecraft:item')?.itemStack;
   return entity?.isValid===true&&item?.typeId===stack.typeId&&item?.amount===stack.amount&&item.isStackableWith(stack);
  };
  drops.push({
   apply(){
    attempted=true;
    const entity=block.dimension.spawnItem(stack,{x:block.x+.5,y:block.y+.4,z:block.z+.5});
    entityId=entity?.id;
    acknowledged=typeof entityId==='string'&&world.getEntity(entityId)?.id===entityId&&owned(entity);
    if(!acknowledged)throw Error('Pepper harvest drop was not acknowledged');
   },
   rollback(){
    if(!attempted)return;
    if(!acknowledged)throw Error('Pepper harvest drop outcome unknown');
    const current=world.getEntity(entityId);
    if(current?.id!==entityId||!owned(current))throw Error('Pepper harvest drop ownership changed');
    let failure;try{current.remove()}catch(error){failure=error}
    if(world.getEntity(entityId)!==undefined)throw failure??Error('Pepper harvest drop removal was not acknowledged');
   }
  });
 }
 // The fruit state is the cost of this harvest. An unknown delivery must
 // retain that cost and quarantine the leaf, not restore repeatable fruit.
 return commitPlantSteps(block,plantFertilizerSteps(clear,drops));
}
function lightAbove(block){
 try{return Number(block.dimension.getLightLevel({x:block.x,y:block.y+1,z:block.z}))||0}catch{return 0}
}
function isDirt(block){
 try{if(block?.hasTag('dirt'))return true}catch{}
 return ['minecraft:dirt','minecraft:grass_block','minecraft:coarse_dirt','minecraft:podzol','minecraft:dirt_with_roots','minecraft:mycelium'].includes(block?.typeId);
}
function isReplaceable(block,origin=false){
 if(!block)return false;
 if(origin&&(block.typeId===PEPPER_SAPLING_ID||block.typeId===PEPPER_WORLDGEN_SEED_ID))return true;
 return REPLACEABLE.has(block.typeId);
}
function isAxe(stack){
 if(!stack)return false;
 try{if(stack.hasTag('minecraft:is_axe'))return true}catch{}
 return AXES.has(stack.typeId);
}
function heldAxe(player){
 const m=getMainHand(player);if(isAxe(m))return {hand:'main',stack:m};
 const o=getOffHand(player);if(isAxe(o))return {hand:'off',stack:o};
 return null;
}
function damageTool(player,entry){
 if(!entry||isCreative(player))return;
 try{
  const stack=entry.stack,d=stack.getComponent('minecraft:durability');if(!d)return;
  const next=(Number(d.damage)||0)+1;
  if(next>=Number(d.maxDurability||0))setHand(player,entry.hand,undefined);
  else{d.damage=next;setHand(player,entry.hand,stack)}
 }catch{}
}
function enchantLevel(stack,id){
 try{return Math.max(0,Number(stack?.getComponent('minecraft:enchantable')?.getEnchantment(id)?.level??0)||0)}catch{return 0}
}

function connectedToPepperLog(start){
 const d=start.dimension,base=start.location,queue=[{x:base.x,y:base.y,z:base.z,dist:0}],seen=new Set([base.x+'|'+base.y+'|'+base.z]);
 let unloaded=false;
 while(queue.length){
  const cur=queue.shift();
  if(cur.dist>=LEAF_DECAY_DISTANCE)continue;
  for(const [dx,dy,dz] of DIRS){
   const p={x:cur.x+dx,y:cur.y+dy,z:cur.z+dz},k=p.x+'|'+p.y+'|'+p.z;if(seen.has(k))continue;seen.add(k);
   let b;try{b=d.getBlock(p)}catch{unloaded=true;continue}
   if(!b){unloaded=true;continue;}
   if(b.typeId===PEPPER_LOG_ID)return true;
   if(b.typeId===PEPPER_LEAVES_ID)queue.push({...p,dist:cur.dist+1});
  }
 }
 return unloaded?null:false;
}

function leafPermutation(hasPepper=false,persistent=false){
 return BlockPermutation.resolve(PEPPER_LEAVES_ID,{
  [HAS_PEPPER_STATE]:!!hasPepper,
  [PERSISTENT_STATE]:!!persistent
 });
}
function logPermutation(){
 return BlockPermutation.resolve(PEPPER_LOG_ID,{'minecraft:block_face':'up'});
}
export function placePepperTree(sapling,outcome={},journal=null){
 outcome.status="blocked";
 const h=pepperTreeHeight(Math.random()),d=sapling.dimension,o=sapling.location;
 if(!isDirt(at(d,o,0,-1,0)))return false;
 for(let y=0;y<h+3;y++)if(!isReplaceable(at(d,o,0,y,0),y===0))return false;
 const randomValues=Array.from({length:96},()=>Math.random()),plan=pepperTreePlan(h,randomValues),writes=[];
 // Resolve every planned block before touching the trunk. Unloaded canopy
 // neighbors must not silently turn a complete tree into a permanent stump.
 for(const p of plan.logs){
  const block=at(d,o,p.x,p.y,p.z);if(!block)return false;
  writes.push({block,before:block.permutation,after:logPermutation()});
 }
 for(const p of plan.leaves){
  const block=at(d,o,p.x,p.y,p.z);if(!block)return false;
  if(block.typeId==='minecraft:air')writes.push({block,before:block.permutation,after:leafPermutation(p.hasPepper,false)});
 }
 // Fertilizer plans may include a preceding sapling-stage advance. Publish all
 // tree blocks with that use's hand debit in one rollback-protected transaction.
 if(journal){for(const entry of writes)journal.set(entry.block,entry.after);outcome.status="grown";return true;}
 const committed=[];outcome.status="deferred";
 try{
  for(const entry of writes){committed.push(entry);entry.block.setPermutation(entry.after);}
  outcome.status="grown";return true;
 }catch{
  let rollbackFailures=0;
  for(const entry of committed.reverse())try{entry.block.setPermutation(entry.before)}catch{rollbackFailures++}
  if(rollbackFailures){outcome.status="fault";console.warn("[Grilling pepper tree] rollback failed for "+rollbackFailures+" blocks");}
  return false;
 }
}
export function growPepperWorldgenSeed(seed){
 if(seed?.typeId!==PEPPER_WORLDGEN_SEED_ID)return 'not_seed';
 const d=seed.dimension,o=seed.location,range=d.heightRange;
 const discard=()=>{if(seed.typeId===PEPPER_WORLDGEN_SEED_ID)seed.setType('minecraft:air');return 'blocked';};
 if(range&&(o.y-1<range.min||o.y+5>=range.max))return discard();
 // Retain the invisible-to-catalog seed only while neighboring chunks are
 // unavailable. Its local block tick retries; never scan or regrow player logs.
 for(let x=-1;x<=1;x++)for(let y=-1;y<=5;y++)for(let z=-1;z<=1;z++)
  if(!at(d,o,x,y,z))return 'deferred';
 const outcome={};if(placePepperTree(seed,outcome))return 'grown';
 // A rejected native write is retryable after successful rollback; do not
 // discard generation provenance as though the site were obstructed.
 return outcome.status==='blocked'?discard():outcome.status;
}
function advanceSapling(block){
 const stage=Number(state(block,SAPLING_STAGE_STATE,0))||0;
 if(nextSaplingAction(stage)==='advance')return setState(block,SAPLING_STAGE_STATE,1);
 return placePepperTree(block);
}

registerPlantFertilizer(PEPPER_SAPLING_ID,(block,journal,random)=>{
 const permutation=journal.read(block),stage=Number(permutation.getState(SAPLING_STAGE_STATE))||0;
 if(saplingBonemealSucceeds(random())){
  if(nextSaplingAction(stage)==='advance')journal.set(block,permutation.withState(SAPLING_STAGE_STATE,1));
  else placePepperTree(block,{},journal);
 }
 return true;
});

function sting(entity){
 if(!entity||!entity.getComponent('minecraft:health')||entity.typeId==='minecraft:fox'||entity.typeId==='minecraft:bee')return;
 try{entity.addEffect('slowness',10,{amplifier:0,showParticles:false})}catch{}
 const now=world.getAbsoluteTime();
 try{
  const until=Number(entity.getDynamicProperty(STING_UNTIL)??0);
  if(now<until)return;
  if(entity.applyDamage(1))entity.setDynamicProperty(STING_UNTIL,now+STING_INTERVAL_TICKS);
 }catch{}
}

function settleLeafDrops(block,plan){
 if(!block||block.typeId!==PEPPER_LEAVES_ID||!plantMutationAllowed(block))return false;
 const before=block.permutation,steps=[{
  apply(){block.setType('minecraft:air');return block.typeId==='minecraft:air';},
  rollback(){block.setPermutation(before);return samePlantPermutation(block.permutation,before);}
 }];
 for(const [id,count] of [[PEPPER_LEAVES_ID,plan.leaves],[PEPPER_SAPLING_ID,plan.saplings],['minecraft:stick',plan.sticks],[SICHUAN_PEPPER_ID,plan.pepper]]){
  if(!count)continue;
  let entity,attempted=false,acknowledged=false;
  steps.push({
   apply(){
    attempted=true;
    entity=block.dimension.spawnItem(new ItemStack(id,count),{x:block.x+.5,y:block.y+.4,z:block.z+.5});
    const item=entity?.getComponent('minecraft:item')?.itemStack;
    acknowledged=entity?.isValid===true&&item?.typeId===id&&item?.amount===count;
    if(!acknowledged)throw Error('Pepper leaf drop was not acknowledged');
   },
   rollback(){
    if(!attempted)return;
    // A spawn that throws after creating its item has no safe handle to remove.
    // Quarantine an unknown outcome instead of restoring a retryable drop source.
    if(!acknowledged)throw Error('Pepper leaf drop outcome unknown');
    entity.remove();
    if(entity.isValid!==false)throw Error('Pepper leaf drop removal was not acknowledged');
   }
  });
 }
 return commitPlantSteps(block,steps);
}
function decayLeaves(block){
 return settleLeafDrops(block,pepperLeafBreakPlan({
  shears:false,silkTouch:false,fortune:0,hasPepper:!!state(block,HAS_PEPPER_STATE,false),
  saplingRandom:Math.random(),stickRandom:Math.random()
 }));
}
function breakLeaves(block,player,tool,hasPepper){
 if(!block||block.typeId!==PEPPER_LEAVES_ID)return;
 if(isCreative(player)){settleLeafDrops(block,{});return;}
 const fortune=enchantLevel(tool,'fortune')||enchantLevel(tool,'minecraft:fortune');
 const silk=(enchantLevel(tool,'silk_touch')||enchantLevel(tool,'minecraft:silk_touch'))>0;
 const plan=pepperLeafBreakPlan({
  shears:tool?.typeId==='minecraft:shears',silkTouch:silk,fortune,hasPepper,
  saplingRandom:Math.random(),stickRandom:Math.random()
 });
 if(!settleLeafDrops(block,plan))return;
 try{block.dimension.playSound('dig.grass',block.location)}catch{}
}

system.beforeEvents.startup.subscribe(init=>{
 init.blockComponentRegistry.registerCustomComponent(LEAVES_COMPONENT_ID,{
  // Native block ticks also recover pepper leaves already saved in old worlds.
  onTick(event){rememberPepperContact(event.block)},
  beforeOnPlayerPlace(event){
   try{event.permutationToPlace=event.permutationToPlace.withState(PERSISTENT_STATE,true).withState(HAS_PEPPER_STATE,false)}catch{}
  },
  onRandomTick(event){
   try{
    const block=event.block;
    if(!plantMutationAllowed(block))return;
    // Java fruits before LeavesBlock.randomTick performs natural decay.
    if(!state(block,HAS_PEPPER_STATE,false)&&shouldFruitPepperLeaf(Math.random()))setState(block,HAS_PEPPER_STATE,true);
    if(!state(block,PERSISTENT_STATE,false)&&connectedToPepperLog(block)===false)decayLeaves(block);
   }catch{}
  },
  onPlayerInteract(event){
   try{
    const block=event.block,player=event.player;if(!player||getMainHand(player))return;
    if(!harvestPepper(block))return;
    awardMountainFragrance(player);
    block.dimension.playSound('block.sweet_berry_bush.pick',block.location,{volume:1,pitch:.8+Math.random()*.4});
   }catch{}
  },
  onStepOn(event){sting(event.entity)}
 });

 init.blockComponentRegistry.registerCustomComponent(SAPLING_COMPONENT_ID,{
  beforeOnPlayerPlace(event){
   try{
    const below=at(event.dimension,event.block.location,0,-1,0);
    if(!isDirt(below)){event.cancel=true;return}
    event.permutationToPlace=event.permutationToPlace.withState(SAPLING_STAGE_STATE,0);
   }catch{event.cancel=true}
  },
  onRandomTick(event){
   try{if(saplingRandomTickSucceeds(lightAbove(event.block),Math.random()))advanceSapling(event.block)}catch{}
  },
  onPlayerInteract:interactWithPlantFertilizer
 });

 init.blockComponentRegistry.registerCustomComponent(LOG_COMPONENT_ID,{
  onPlayerInteract(event){
   try{
    const player=event.player,block=event.block;if(!player)return;
    const axe=heldAxe(player);if(!axe)return;
    const axis=pepperLogAxis(state(block,'minecraft:block_face','up'));
    block.setPermutation(BlockPermutation.resolve('minecraft:stripped_oak_log',{pillar_axis:axis}));
    damageTool(player,axe);
    block.dimension.playSound('dig.wood',block.location,{volume:.8,pitch:1.1});
   }catch{}
  }
 });
});

onBeforeBlockBreak('world/pepper_tree_runtime.js:0',e=>{
 try{
  if(e.cancel||e.block.typeId!==PEPPER_LEAVES_ID)return;
  const loc={...e.block.location},dim=e.block.dimension,p=e.player,tool=e.itemStack?.clone(),before=e.block.permutation;
  const hasPepper=!!before.getState(HAS_PEPPER_STATE);
  e.cancel=true;system.run(()=>{
   try{
    const block=dim.getBlock(loc);
    if(block&&samePlantPermutation(block.permutation,before))breakLeaves(block,p,tool,hasPepper);
   }catch{}
  });
 }catch{}
});

// Track loaded entities once. Sparse pepper-source buckets replace whole-world
// voxel scans; fair continuations bound even a large body or crowded dimension.
for(const name of ['entitySpawn','entityLoad'])world.afterEvents[name].subscribe(({entity})=>{
 try{pepperContacts.track(entity);}catch(error){contactError(error);}
});
world.afterEvents.entityRemove.subscribe(({removedEntityId})=>pepperContacts.forget(removedEntityId));
world.afterEvents.playerSpawn.subscribe(({player})=>pepperContacts.track(player));
world.afterEvents.playerDimensionChange.subscribe(({player})=>pepperContacts.track(player));
world.afterEvents.playerLeave.subscribe(({playerId})=>pepperContacts.forget(playerId));
every('a2748_pepper_tree_runtime:1',()=>{
 // Native census returns an array synchronously, once per recovered source
 // dimension. Its API cost is separate; handle insertion is capped at16/tick.
 const next=contactCensus.entries().next();
 if(!next.done){const [d,dimension]=next.value;contactCensus.delete(d);try{
  if(pepperContacts.hasLeaves(d)){
   pepperContacts.queueRecovery(d,dimension.getEntities());
   // Player recovery is explicit, rather than depending on query inclusion.
   pepperContacts.queueRecovery(d+'|players',onlinePlayers());
  }
  else recoveredContactDimensions.delete(d);
 }catch(error){recoveredContactDimensions.delete(d);contactError(error);}}
 pepperContacts.tick(system.currentTick,{
 valid:entity=>entity.isValid,
 dimension:entity=>entity.dimension.id,
 eligible:entity=>entity.typeId!=='minecraft:fox'&&entity.typeId!=='minecraft:bee'&&!!entity.getComponent('minecraft:health'),
 bounds:entity=>entity.getAABB(),
 leaf(d,p){const block=at(world.getDimension(d),p);return !block?'unloaded':block.typeId===PEPPER_LEAVES_ID?'leaf':'missing';},
 sting,error:contactError
 });
},1);
