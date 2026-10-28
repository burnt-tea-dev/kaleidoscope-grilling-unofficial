import {system,ItemStack} from '@minecraft/server';
import {registerPlantFertilizer,interactWithPlantFertilizer} from '../plant_fertilizer.js';
import {
 CROP_ID,HOUTTUYNIA_ID,COMPONENT_ID,AGE_STATE,RED_STATE,MAX_AGE,
 placementRedVariant,canCropSurvive,bonemealAgeIncrease,
 javaCropGrowthSpeed,shouldAdvanceAge,matureBonusCount
} from './houttuynia_crop_core.js';

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
function state(block,id,fallback){
 try{const v=block.permutation.getState(id);return v===undefined?fallback:v}catch{return fallback}
}
function preserveRed(block,permutation){
 const below=at(block.dimension,block.location,0,-1,0);
 const red=below?.typeId==='minecraft:soul_sand'||!!state(block,RED_STATE,false);
 try{return permutation.withState(RED_STATE,red)}catch{return permutation}
}
function setAge(block,age){
 try{
  let p=block.permutation.withState(AGE_STATE,Math.max(0,Math.min(MAX_AGE,Math.floor(Number(age)||0))));
  p=preserveRed(block,p);
  block.setPermutation(p);
  return true;
 }catch{return false}
}
registerPlantFertilizer(CROP_ID,(block,journal,random)=>{
 const permutation=journal.read(block),age=Number(permutation.getState(AGE_STATE))||0;
 if(age>=MAX_AGE)return false;
 journal.set(block,preserveRed(block,permutation.withState(AGE_STATE,Math.min(MAX_AGE,age+bonemealAgeIncrease(random())))));
 return true;
});

system.beforeEvents.startup.subscribe(init=>{
 init.blockComponentRegistry.registerCustomComponent(COMPONENT_ID,{
  beforeOnPlayerPlace(event){
   try{
    const loc=event.block.location,below=at(event.dimension,loc,0,-1,0);
    const light=lightAt(event.dimension,loc);
    if(!canCropSurvive(below?.typeId??'',light)){event.cancel=true;return}
    const red=placementRedVariant(below?.typeId??'',Math.random());
    event.permutationToPlace=event.permutationToPlace.withState(AGE_STATE,0).withState(RED_STATE,red);
   }catch{event.cancel=true}
  },
  onRandomTick(event){
   try{
    const block=event.block,below=at(event.dimension,block.location,0,-1,0);
    const light=lightAt(event.dimension,block.location);
    if(!canCropSurvive(below?.typeId??'',light)){
     const age=Number(state(block,AGE_STATE,0))||0;
     const count=age>=MAX_AGE?1+matureBonusCount(0,[Math.random()]):1;
     event.dimension.setBlockType(block.location,'minecraft:air');
     event.dimension.spawnItem(new ItemStack(HOUTTUYNIA_ID,count),{x:block.location.x+.5,y:block.location.y+.25,z:block.location.z+.5});
     return;
    }
    const age=Number(state(block,AGE_STATE,0))||0;
    if(age>=MAX_AGE)return;
    const speed=javaCropGrowthSpeed(groundCells(block),cropNeighbors(block));
    if(shouldAdvanceAge(light,speed,Math.random()))setAge(block,age+1);
   }catch{}
  },
  onPlayerInteract:interactWithPlantFertilizer
 });
});
