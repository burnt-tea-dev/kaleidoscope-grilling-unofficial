import {world,EquipmentSlot,GameMode,BlockPermutation,ItemStack} from '@minecraft/server';
import {commitSteps} from './grill/grill_transaction_core.js';
import {bonemealAgeIncrease,javaCropGrowthSpeed,javaCropGrowthChance} from './world/houttuynia_crop_core.js';
import {createOwnedPlantWrite,plantFertilizerSteps} from './plant_fertilizer_transaction_core.js';

const BONE_MEAL='minecraft:bone_meal',OIL_RESIDUE='kaleidoscope_grilling:oil_residue';
const handlers=new Map();
const faulted=new Set();
function blockKey(block){
 const p=block.location;
 return block.dimension.id+'|'+p.x+'|'+p.y+'|'+p.z;
}
function faultKey(block){return 'kaleidoscope_grilling:plant_transaction_fault_'+encodeURIComponent(blockKey(block));}
export function plantMutationAllowed(block){
 const key=faultKey(block);
 return !faulted.has(key)&&world.getDynamicProperty(key)===undefined;
}
export function commitPlantSteps(block,steps,participants=[block]){
 const involved=new Map([[blockKey(block),block],...participants.map(target=>[blockKey(target),target])]);
 if([...involved.values()].some(target=>!plantMutationAllowed(target)))return false;
 const result=commitSteps(steps);
 if(result.rollbackErrors){
  // A double plant can be used through either half. An unknown item delivery
  // must also block its partner, otherwise the other half can repeat it.
  for(const target of involved.values()){
   const key=faultKey(target);faulted.add(key);
   try{world.setDynamicProperty(key,true)}catch{}
  }
  console.warn('[Grilling plant] transaction requires recovery at '+blockKey(block));
 }
 return result.ok;
}
export function samePlantPermutation(a,b){
 if(a.type.id!==b.type.id)return false;
 const actual=a.getAllStates(),expected=b.getAllStates();
 return Object.keys(actual).length===Object.keys(expected).length&&Object.keys(expected).every(key=>actual[key]===expected[key]);
}
function readPlantLight(block){
 const total=block.getLightLevel(),sky=block.getSkyLightLevel();
 if(![total,sky].every(value=>Number.isInteger(value)&&value>=0&&value<=15))throw Error('Plant fertilizer light unavailable');
 return {total,sky};
}
function readPlantWaterlogged(block){
 const value=block.isWaterlogged;
 if(typeof value!=='boolean')throw Error('Plant fertilizer water state unavailable');
 return value;
}
function samePlantSnapshot(actual,expected){
 return actual.waterlogged===expected.waterlogged&&samePlantPermutation(actual.permutation,expected.permutation);
}
function growthJournal(){
 const observed=new Map(),deliveries=[];
 function observe(block){
  const key=blockKey(block);
  if(!observed.has(key))observed.set(key,{block,before:block.permutation});
  return observed.get(key);
 }
 return {
  read(block){const entry=observe(block);return entry.after??entry.before;},
  set(block,after,{afterNeighbors=false}={}){
   Object.assign(observe(block),{after,afterNeighbors});
  },
  dry(block){
   const entry=observe(block);
   entry.waterlogged??=readPlantWaterlogged(block);
   return entry.waterlogged===false;
  },
  light(block){
   const entry=observe(block);
   entry.light??=readPlantLight(block);
   // Java getRawBrightness(pos,0) keeps un-subtracted sky light. Bedrock
   // exposes total and sky brightness separately; their maximum is the
   // bounded adapter, not a claim of tested night/weather equivalence.
   return Math.max(entry.light.total,entry.light.sky);
  },
  drop(block,id,random){
   const stack=new ItemStack(id,1),p=block.location;
   // Java Block.popResource: +/- .25 around the block centre, with the
   // item entity's half-height (.125) removed from the vertical position.
   const location={x:p.x+.25+random()*.5,y:p.y+.125+random()*.5,z:p.z+.25+random()*.5};
   if(!world.gameRules.doTileDrops)return;
   let entity,entityId,attempted=false,acknowledged=false;
   deliveries.push({
    apply(){
     attempted=true;entity=block.dimension.spawnItem(stack,location);
     entityId=entity?.id;
     const delivered=entity?.getComponent('minecraft:item')?.itemStack;
     acknowledged=typeof entityId==='string'&&world.getEntity(entityId)?.id===entityId&&entity?.isValid===true&&sameStack(delivered,stack);
     if(!acknowledged)throw Error('Plant fertilizer drop was not acknowledged');
    },
    rollback(){
     if(!attempted)return;
     if(!acknowledged)throw Error('Plant fertilizer drop outcome unknown');
     // A missing/changed drop may already have been picked up or merged. It
     // is not proof of our rollback and cannot authorize a fertilizer refund.
     const current=world.getEntity(entityId);
     if(current?.id!==entityId||current.isValid!==true||!sameStack(current.getComponent('minecraft:item')?.itemStack,stack))throw Error('Plant fertilizer drop ownership changed');
     let failure;try{current.remove()}catch(error){failure=error}
     if(world.getEntity(entityId)!==undefined)throw failure??Error('Plant fertilizer drop removal was not acknowledged');
    }
   });
  },
  current(){return [...observed.values()].every(({block,before,light,waterlogged})=>{
   if(!samePlantPermutation(block.permutation,before))return false;
   if(waterlogged!==undefined&&readPlantWaterlogged(block)!==waterlogged)return false;
   if(!light)return true;
   const current=readPlantLight(block);
   return current.total===light.total&&current.sky===light.sky;
  });},
  blocks(){return [...observed.values()].map(entry=>entry.block);},
  steps(){return [...observed.values()].filter(entry=>entry.after)
   // The fruit must exist before its stem is attached. Keep all existing
   // handlers' ordering; only explicitly dependent writes move to the end.
   .sort((a,b)=>Number(a.afterNeighbors)-Number(b.afterNeighbors)).map(({block,before,after,waterlogged})=>createOwnedPlantWrite({
   read:()=>({permutation:block.permutation,waterlogged:waterlogged===undefined?undefined:readPlantWaterlogged(block)}),
   write:snapshot=>block.setPermutation(snapshot.permutation),same:samePlantSnapshot,
   before:{permutation:before,waterlogged},after:{permutation:after,waterlogged},
   // A previous plant write can trigger the exact planned neighbour update.
   // Other native permutations are unknown, not permission to overwrite them.
   acceptPlannedAfter:true
  })).concat(deliveries);}
 };
}
export function registerPlantFertilizer(id,handler){
 if(handlers.has(id))throw Error('Duplicate plant fertilizer handler: '+id);
 handlers.set(id,handler);
}
export function hasPlantFertilizer(block,itemId,hand='main',secondaryUse=false){
 if(!block||!handlers.has(block.typeId))return false;
 if(block.typeId==='minecraft:mangrove_propagule'&&block.permutation.getState('hanging')!==true)return false;
 if(itemId===OIL_RESIDUE&&block.typeId==='minecraft:sweet_berry_bush'){
  // NeoForge 1.21.1's default block interaction picks berries on a normal
  // main-hand use. Sneaking skips that interaction; it is not invoked for an
  // offhand item use. Only the real BONE_MEAL item gets its own early bypass.
  const age=block.permutation.getState('growth');
  return Number.isInteger(age)&&age>=0&&age<=3&&(age<2||hand==='off'||secondaryUse===true);
 }
 return true;
}
function fertilizerSlot(player,hand){
 const eq=player.getComponent('minecraft:equippable');
 const choices=hand?[hand==='off'?EquipmentSlot.Offhand:EquipmentSlot.Mainhand]:[EquipmentSlot.Mainhand,EquipmentSlot.Offhand];
 for(const choice of choices){
  const slot=eq?.getEquipmentSlot(choice),stack=slot?.hasItem()?slot.getItem():undefined;
  if(stack?.typeId===BONE_MEAL||stack?.typeId===OIL_RESIDUE)return {slot,stack:stack.clone(),hand:choice===EquipmentSlot.Offhand?'off':'main'};
 }
 return undefined;
}
function sameStack(actual,expected){
 if(!actual||!expected)return actual===undefined&&expected===undefined;
 return actual.amount===expected.amount&&actual.typeId===expected.typeId&&actual.isStackableWith(expected);
}
// Each pass calls the same plant handler as ordinary bone meal. Planning both
// passes before mutation preserves plant-specific stages, RNG and tree writes.
// An accepted sapling use consumes fertilizer even when its growth RNG misses,
// just as BoneMealItem.useOn does; an invalid/mature target does not consume it.
export function usePlantFertilizer(block,player,hand){
 try{
  if(!block||!plantMutationAllowed(block))return false;
  const entry=fertilizerSlot(player,hand),secondaryUse=player.isSneaking===true;
  if(!entry||!hasPlantFertilizer(block,entry.stack.typeId,entry.hand,secondaryUse))return false;
  const journal=growthJournal(),passes=entry.stack.typeId===OIL_RESIDUE?2:1;
  let accepted=false;
  for(let pass=0;pass<passes;pass++){
   const handler=handlers.get(journal.read(block).type.id);
   if(handler?.(block,journal,Math.random))accepted=true;
  }
  if(!accepted)return false;
  // Reads include unchanged partners/supports as well as written blocks.
  // Validate the complete native snapshots before the first debit or write.
  if((player.isSneaking===true)!==secondaryUse||!journal.current()||!sameStack(entry.slot.hasItem()?entry.slot.getItem():undefined,entry.stack))return false;
  let debit;
  if(player.getGameMode()!==GameMode.Creative){
   const before=entry.stack,after=before.amount>1?before.clone():undefined;
   if(after)after.amount--;
   debit=createOwnedPlantWrite({
    read:()=>entry.slot.hasItem()?entry.slot.getItem():undefined,
    write:stack=>entry.slot.setItem(stack?.clone()),same:sameStack,before,after
   });
  }
  const steps=plantFertilizerSteps(debit,journal.steps());
  if(!commitPlantSteps(block,steps,journal.blocks()))return false;
  try{const p=block.location;block.dimension.spawnParticle('minecraft:crop_growth_emitter',{x:p.x+.5,y:p.y+.5,z:p.z+.5})}catch{}
  return true;
 }catch{return false}
}
export function interactWithPlantFertilizer(event){
 if(event.player)usePlantFertilizer(event.block,event.player);
}

// @minecraft/server 2.9.0 has placeFeature, but no generic native bone-meal
// invocation or feature-write journal. Explicit handlers below reproduce each
// reviewed Java BonemealableBlock contract. Other plants remain unsupported.
// Source and state mapping: docs/evidence/vanilla-plant-fertilizer.md.
for(const id of ['minecraft:wheat','minecraft:carrots','minecraft:potatoes'])registerPlantFertilizer(id,(block,journal,random)=>{
 const permutation=journal.read(block),age=permutation.getState('growth');
 if(typeof age!=='number'||age>=7)return false;
 journal.set(block,permutation.withState('growth',Math.min(7,age+bonemealAgeIncrease(random()))));
 return true;
});

registerPlantFertilizer('minecraft:cocoa',(block,journal)=>{
 const permutation=journal.read(block),age=permutation.getState('age');
 if(!Number.isInteger(age)||age<0||age>=2)return false;
 journal.set(block,permutation.withState('age',age+1));
 return true;
});

registerPlantFertilizer('minecraft:sweet_berry_bush',(block,journal)=>{
 const permutation=journal.read(block),age=permutation.getState('growth');
 if(!Number.isInteger(age)||age<0||age>=3)return false;
 journal.set(block,permutation.withState('growth',age+1));
 return true;
});

registerPlantFertilizer('minecraft:pink_petals',(block,journal,random)=>{
 const permutation=journal.read(block),growth=permutation.getState('growth');
 if(!Number.isInteger(growth)||growth<0||growth>3)return false;
 if(growth<3)journal.set(block,permutation.withState('growth',growth+1));
 else journal.drop(block,'minecraft:pink_petals',random);
 return true;
});

function plantNeighbor(block,journal,dy,dx=0,dz=0){
 const p=block.location,target=block.dimension.getBlock({x:p.x+dx,y:p.y+dy,z:p.z+dz});
 // Missing/unloaded is not air and must not consume an unplanned attempt.
 if(!target)throw Error('Plant fertilizer neighbour unavailable');
 return {block:target,permutation:journal.read(target)};
}

const FERTILIZER_CAVE_VINES=new Set([
 'minecraft:cave_vines','minecraft:cave_vines_body_with_berries','minecraft:cave_vines_head_with_berries'
]);
registerPlantFertilizer('minecraft:cave_vines',(block,journal)=>{
 const permutation=journal.read(block),age=permutation.getState('growing_plant_age');
 if(!Number.isInteger(age)||age<0||age>25)return false;
 const below=plantNeighbor(block,journal,-1);
 const nextId=FERTILIZER_CAVE_VINES.has(below.permutation.type.id)
  ?'minecraft:cave_vines_body_with_berries':'minecraft:cave_vines_head_with_berries';
 journal.set(block,BlockPermutation.resolve(nextId,permutation.getAllStates()));
 // CaveVinesBlock and CaveVinesPlantBlock only set BERRIES=true. They do not
 // call the inherited vine-extension routine. A second pass sees berries and
 // cannot fertilize again; normal berry picking stays with the native block.
 return true;
});

// Java TallFlowerBlock is valid on either half and drops one matching item
// per accepted use. Keep both native halves in the same recovery boundary.
for(const id of ['minecraft:sunflower','minecraft:lilac','minecraft:rose_bush','minecraft:peony'])registerPlantFertilizer(id,(block,journal,random)=>{
 const permutation=journal.read(block),upper=permutation.getState('upper_block_bit');
 if(typeof upper!=='boolean')return false;
 const partner=plantNeighbor(block,journal,upper?-1:1).permutation;
 if(partner.type.id!==id||partner.getState('upper_block_bit')!==!upper)return false;
 journal.drop(block,id,random);
 return true;
});

// Both selected Java versions use #minecraft:dirt or farmland for BushBlock
// survival. Rooted dirt uses Bedrock's distinct dirt_with_roots ID.
const FERTILIZER_GRASS_SOILS=new Set([
 'minecraft:dirt','minecraft:grass_block','minecraft:podzol','minecraft:coarse_dirt',
 'minecraft:mycelium','minecraft:dirt_with_roots','minecraft:moss_block','minecraft:mud',
 'minecraft:muddy_mangrove_roots','minecraft:farmland'
]);
for(const [id,tall] of [['minecraft:short_grass','minecraft:tall_grass'],['minecraft:fern','minecraft:large_fern']])registerPlantFertilizer(id,(block,journal)=>{
 const below=plantNeighbor(block,journal,-1),above=plantNeighbor(block,journal,1);
 if(FERTILIZER_GRASS_SOILS.has(below.permutation.type.id)&&above.permutation.type.id==='minecraft:air'){
  journal.set(block,BlockPermutation.resolve(tall,{upper_block_bit:false}));
  journal.set(above.block,BlockPermutation.resolve(tall,{upper_block_bit:true}));
 }
 // TallGrassBlock.isValidBonemealTarget/isBonemealSuccess are true even if
 // performBonemeal finds blocked headroom. Such an accepted use still costs 1.
 return true;
});

// RootedDirtBlock only accepts air below and produces exactly one hanging
// roots block. The second oil-residue pass sees occupied space and is invalid.
registerPlantFertilizer('minecraft:dirt_with_roots',(block,journal)=>{
 const below=plantNeighbor(block,journal,-1);
 if(below.permutation.type.id!=='minecraft:air')return false;
 journal.set(below.block,BlockPermutation.resolve('minecraft:hanging_roots'));
 return true;
});

registerPlantFertilizer('minecraft:mangrove_leaves',(block,journal)=>{
 const below=plantNeighbor(block,journal,-1);
 if(below.permutation.type.id!=='minecraft:air'||!journal.dry(below.block))return false;
 journal.set(below.block,BlockPermutation.resolve('minecraft:mangrove_propagule',{hanging:true,propagule_stage:0}));
 // Both oil-residue passes still target these leaves. The new propagule makes
 // the second leaf application invalid; it does not mature the new seedling.
 return true;
});

registerPlantFertilizer('minecraft:mangrove_propagule',(block,journal)=>{
 const permutation=journal.read(block),age=permutation.getState('propagule_stage');
 if(permutation.getState('hanging')!==true||!Number.isInteger(age)||age<0||age>=4||!journal.dry(block))return false;
 // Only the hanging, dry branch has a complete state/rollback contract here.
 // Ground-planted trees and waterlogged propagules remain unsupported.
 journal.set(block,permutation.withState('propagule_stage',age+1));
 return true;
});

// Java Direction.Plane.HORIZONTAL order is NORTH, EAST, SOUTH, WEST. Only a
// single direction is sampled; blocked sides do not cause a search/re-roll.
const FERTILIZER_STEM_DIRECTIONS=Object.freeze([
 Object.freeze({dx:0,dz:-1,facing:2}),Object.freeze({dx:1,dz:0,facing:5}),
 Object.freeze({dx:0,dz:1,facing:3}),Object.freeze({dx:-1,dz:0,facing:4})
]);
function stemGrowthSpeed(block,journal,id){
 const cells=[];
 for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
  const {permutation}=plantNeighbor(block,journal,-1,dx,dz);
  const typeId=permutation.type.id,moisture=permutation.getState('moisturized_amount');
  if(typeId==='minecraft:farmland'&&(!Number.isInteger(moisture)||moisture<0||moisture>7))throw Error('Plant fertilizer soil state unavailable');
  cells.push({typeId,moisture});
 }
 const sameStem=(dx,dz)=>{
  const {permutation}=plantNeighbor(block,journal,0,dx,dz);
  // Java AttachedStemBlock is a different block and is not a matching crop
  // in getGrowthSpeed. Bedrock encodes that distinction in facing_direction.
  return permutation.type.id===id&&permutation.getState('facing_direction')===0;
 };
 return javaCropGrowthSpeed(cells,{
  west:sameStem(-1,0),east:sameStem(1,0),north:sameStem(0,-1),south:sameStem(0,1),
  northWest:sameStem(-1,-1),northEast:sameStem(1,-1),southWest:sameStem(-1,1),southEast:sameStem(1,1)
 });
}
for(const [id,fruit] of [['minecraft:melon_stem','minecraft:melon_block'],['minecraft:pumpkin_stem','minecraft:pumpkin']])registerPlantFertilizer(id,(block,journal,random)=>{
 const permutation=journal.read(block),age=permutation.getState('growth');
 if(!Number.isInteger(age)||age<0||age>=7||permutation.getState('facing_direction')!==0)return false;
 const nextAge=Math.min(7,age+bonemealAgeIncrease(random())),grown=permutation.withState('growth',nextAge);
 journal.set(block,grown);
 // performBonemeal invokes randomTick only on the pass that first reaches
 // seven. An already mature (even unattached) stem is never another attempt.
 if(nextAge!==7||journal.light(block)<9)return true;
 const speed=stemGrowthSpeed(block,journal,id);
 if(random()>=javaCropGrowthChance(speed))return true;
 const direction=FERTILIZER_STEM_DIRECTIONS[Math.floor(random()*4)];
 const target=plantNeighbor(block,journal,0,direction.dx,direction.dz);
 const support=plantNeighbor(block,journal,-1,direction.dx,direction.dz);
 if(target.permutation.type.id!=='minecraft:air'||!FERTILIZER_GRASS_SOILS.has(support.permutation.type.id))return true;
 journal.set(target.block,BlockPermutation.resolve(fruit));
 journal.set(block,grown.withState('facing_direction',direction.facing),{afterNeighbors:true});
 return true;
});

function netherVineGrowthLength(random){
 let chance=1,length=0;
 while(random()<chance){chance*=.826;length++;}
 return length;
}
function netherVineTip(block,journal,id,ageState,dy){
 let tip={block,permutation:journal.read(block)};
 for(;;){
  const age=tip.permutation.getState(ageState);
  if(!Number.isInteger(age)||age<0||age>25)throw Error('Plant fertilizer vine age unavailable');
  const next=plantNeighbor(tip.block,journal,dy);
  if(next.permutation.type.id!==id)return {tip,next};
  tip=next;
 }
}
for(const [id,ageState,dy] of [
 ['minecraft:twisting_vines','twisting_vines_age',1],
 ['minecraft:weeping_vines','weeping_vines_age',-1]
])registerPlantFertilizer(id,(block,journal,random)=>{
 // Java body use locates its connected head. Bedrock stores both as one ID,
 // so the terminal same-ID block is the head. Start each oil-residue pass at
 // the original clicked block, reading the previous pass's virtual growth.
 let {tip,next}=netherVineTip(block,journal,id,ageState,dy);
 if(next.permutation.type.id!=='minecraft:air')return false;
 const length=netherVineGrowthLength(random);
 let age=Math.min(tip.permutation.getState(ageState)+1,25);
 for(let i=0;i<length&&next.permutation.type.id==='minecraft:air';i++){
  // The former head becomes Java's ageless body (Bedrock representative age
  // zero). New heads increment to 25; age 25 still accepts bone meal even
  // though it stops Java's natural random growth.
  journal.set(tip.block,tip.permutation.withState(ageState,0));
  const grown=BlockPermutation.resolve(id,{[ageState]:age});
  journal.set(next.block,grown);
  tip={block:next.block,permutation:grown};age=Math.min(age+1,25);
  if(i+1<length)next=plantNeighbor(tip.block,journal,dy);
 }
 return true;
});
