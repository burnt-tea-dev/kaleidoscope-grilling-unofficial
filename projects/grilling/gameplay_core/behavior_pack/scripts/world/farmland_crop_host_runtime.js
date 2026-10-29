import {onAfterBlockBreak} from '../core/events.js';
import {world,system,ItemStack,EquipmentSlot,GameMode} from '@minecraft/server';
import {farmlandCropTable} from './farmland_crop_host_core.js';
import {registerPlantFertilizer,interactWithPlantFertilizer} from '../plant_fertilizer.js';
import {
 STRAW_HATS,
 canolaSurvive,matureCanolaCount,
 bonemealAgeIncrease,javaCropGrowthSpeed,shouldAdvanceAge
} from './canola_crop_core.js';
import {
 onionSurvive,matureOnionCount
} from './onion_crop_core.js';
import {
 sweetPotatoSurvive,matureSweetPotatoCount,cropDropPlan
} from './sweet_potato_crop_core.js';

const BEHAVIOR=Object.freeze({
 canola:Object.freeze({survive:canolaSurvive,matureCount:matureCanolaCount}),
 onion:Object.freeze({survive:onionSurvive,matureCount:matureOnionCount}),
 sweet_potato:Object.freeze({survive:sweetPotatoSurvive,matureCount:matureSweetPotatoCount})
});

function at(dimension,location,dx=0,dy=0,dz=0){
 try{return dimension.getBlock({x:location.x+dx,y:location.y+dy,z:location.z+dz})}catch{return undefined}
}
function lightAt(dimension,location){
 try{return Number(dimension.getLightLevel(location))||0}catch{return 0}
}
function moisture(block){
 try{return Number(block?.permutation?.getState('moisturized_amount')??0)||0}catch{return 0}
}
function groundCells(block){
 const out=[];
 for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
  const b=at(block.dimension,block.location,dx,-1,dz);
  out.push({typeId:b?.typeId??'',moisture:moisture(b)});
 }
 return out;
}
function cropNeighbors(block,cropId){
 const isCrop=(dx,dz)=>at(block.dimension,block.location,dx,0,dz)?.typeId===cropId;
 return {
  west:isCrop(-1,0),east:isCrop(1,0),north:isCrop(0,-1),south:isCrop(0,1),
  northWest:isCrop(-1,-1),northEast:isCrop(1,-1),southWest:isCrop(-1,1),southEast:isCrop(1,1)
 };
}
function ageOf(block,ageState){
 try{return Number(block.permutation.getState(ageState))||0}catch{return 0}
}
function setAge(block,ageState,maxAge,age){
 try{
  block.setPermutation(block.permutation.withState(ageState,Math.max(0,Math.min(maxAge,Math.floor(Number(age)||0)))));
  return true;
 }catch{return false}
}
function creative(player){
 try{return player.getGameMode?.()===GameMode.Creative}catch{return false}
}
function fortuneLevel(stack){
 try{
  const c=stack?.getComponent('minecraft:enchantable');
  return Math.max(0,Number(c?.getEnchantment('fortune')?.level??c?.getEnchantment('minecraft:fortune')?.level??0)||0);
 }catch{return 0}
}
function headItem(player){
 try{return player.getComponent('minecraft:equippable')?.getEquipment(EquipmentSlot.Head)}catch{return undefined}
}
function dropAt(block,id,count){
 if(count<=0)return;
 block.dimension.spawnItem(new ItemStack(id,count),{x:block.location.x+.5,y:block.location.y+.25,z:block.location.z+.5});
}
function matureCount(cfg){
 const behavior=BEHAVIOR[cfg.key];
 const draws=Array.from({length:cfg.matureRandomDraws},()=>Math.random());
 return behavior.matureCount(0,draws);
}
function componentFor(cfg){
 const behavior=BEHAVIOR[cfg.key];
 return {
  beforeOnPlayerPlace(event){
   try{
    const below=at(event.dimension,event.block.location,0,-1,0);
    if(!behavior.survive(below?.typeId??'',lightAt(event.dimension,event.block.location))){event.cancel=true;return}
    event.permutationToPlace=event.permutationToPlace.withState(cfg.ageState,0);
   }catch{event.cancel=true}
  },
  onRandomTick(event){
   try{
    const block=event.block,below=at(event.dimension,block.location,0,-1,0),light=lightAt(event.dimension,block.location);
    if(!behavior.survive(below?.typeId??'',light)){
     const age=ageOf(block,cfg.ageState),count=age>=cfg.maxAge?matureCount(cfg):1;
     event.dimension.setBlockType(block.location,'minecraft:air');
     dropAt(block,cfg.outputId,count);
     return;
    }
    const age=ageOf(block,cfg.ageState);if(age>=cfg.maxAge)return;
    const speed=javaCropGrowthSpeed(groundCells(block),cropNeighbors(block,cfg.cropId));
    if(shouldAdvanceAge(light,speed,Math.random()))setAge(block,cfg.ageState,cfg.maxAge,age+1);
   }catch{}
  },
  onPlayerInteract:interactWithPlantFertilizer
 };
}

for(const cfg of farmlandCropTable())registerPlantFertilizer(cfg.cropId,(block,journal,random)=>{
 const permutation=journal.read(block),age=Number(permutation.getState(cfg.ageState))||0;
 if(age>=cfg.maxAge)return false;
 journal.set(block,permutation.withState(cfg.ageState,Math.min(cfg.maxAge,age+bonemealAgeIncrease(random()))));
 return true;
});

system.beforeEvents.startup.subscribe(init=>{
 for(const cfg of farmlandCropTable()){
  init.blockComponentRegistry.registerCustomComponent(cfg.componentId,componentFor(cfg));
 }
});

// Preserve A2.7.19's single Java CropDropHandler order and RNG draw ordering.
onAfterBlockBreak('world/farmland_crop_host_runtime.js:0',event=>{
 try{
  if(event.brokenBlockPermutation?.type?.id!=='minecraft:short_grass')return;
  const player=event.player;if(!player||creative(player))return;
  if(!STRAW_HATS.includes(headItem(player)?.typeId??''))return;
  const fortune=fortuneLevel(event.itemStackBeforeBreak);
  const draws=Array.from({length:6},()=>Math.random());
  for(const drop of cropDropPlan(draws,fortune))dropAt(event.block,drop.id,drop.count);
 }catch{}
});
