import {world,system,ItemStack,EquipmentSlot,GameMode} from '@minecraft/server';
import {
 CROP_ID,ONION_ID,COMPONENT_ID,AGE_STATE,MAX_AGE,STRAW_HATS,
 onionSurvive,onionAcquisitionCount,shouldDropOnionAcquisition,matureOnionCount,
 bonemealAgeIncrease,javaCropGrowthSpeed,shouldAdvanceAge
} from './onion_crop_core.js';

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
function cropNeighbors(block){
 const isCrop=(dx,dz)=>at(block.dimension,block.location,dx,0,dz)?.typeId===CROP_ID;
 return {
  west:isCrop(-1,0),east:isCrop(1,0),north:isCrop(0,-1),south:isCrop(0,1),
  northWest:isCrop(-1,-1),northEast:isCrop(1,-1),southWest:isCrop(-1,1),southEast:isCrop(1,1)
 };
}
function ageOf(block){
 try{return Number(block.permutation.getState(AGE_STATE))||0}catch{return 0}
}
function setAge(block,age){
 try{
  block.setPermutation(block.permutation.withState(AGE_STATE,Math.max(0,Math.min(MAX_AGE,Math.floor(Number(age)||0)))));
  return true;
 }catch{return false}
}
function creative(player){
 try{return player.getGameMode?.()===GameMode.Creative}catch{return false}
}
function boneMealSlot(player){
 try{
  const eq=player.getComponent('minecraft:equippable');
  for(const hand of [EquipmentSlot.Mainhand,EquipmentSlot.Offhand]){
   const slot=eq?.getEquipmentSlot(hand),stack=slot?.hasItem()?slot.getItem():undefined;
   if(stack?.typeId==='minecraft:bone_meal')return {slot,stack};
  }
 }catch{}
 return undefined;
}
function consumeBoneMeal(player,entry){
 if(!entry||creative(player))return;
 try{
  const stack=entry.stack;
  if(stack.amount<=1)entry.slot.setItem(undefined);else{stack.amount-=1;entry.slot.setItem(stack)}
 }catch{}
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

system.beforeEvents.startup.subscribe(init=>{
 init.blockComponentRegistry.registerCustomComponent(COMPONENT_ID,{
  beforeOnPlayerPlace(event){
   try{
    const below=at(event.dimension,event.block.location,0,-1,0);
    if(!onionSurvive(below?.typeId??'',lightAt(event.dimension,event.block.location))){event.cancel=true;return}
    event.permutationToPlace=event.permutationToPlace.withState(AGE_STATE,0);
   }catch{event.cancel=true}
  },
  onRandomTick(event){
   try{
    const block=event.block,below=at(event.dimension,block.location,0,-1,0),light=lightAt(event.dimension,block.location);
    if(!onionSurvive(below?.typeId??'',light)){
     const age=ageOf(block),count=age>=MAX_AGE?matureOnionCount(0,[Math.random(),Math.random()]):1;
     event.dimension.setBlockType(block.location,'minecraft:air');dropAt(block,ONION_ID,count);return;
    }
    const age=ageOf(block);if(age>=MAX_AGE)return;
    const speed=javaCropGrowthSpeed(groundCells(block),cropNeighbors(block));
    if(shouldAdvanceAge(light,speed,Math.random()))setAge(block,age+1);
   }catch{}
  },
  onPlayerInteract(event){
   try{
    const player=event.player;if(!player)return;
    const age=ageOf(event.block);if(age>=MAX_AGE)return;
    const meal=boneMealSlot(player);if(!meal)return;
    if(setAge(event.block,Math.min(MAX_AGE,age+bonemealAgeIncrease(Math.random()))))consumeBoneMeal(player,meal);
   }catch{}
  }
 });
});

