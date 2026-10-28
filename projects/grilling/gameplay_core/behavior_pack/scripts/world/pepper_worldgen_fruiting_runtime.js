import {system,BlockPermutation} from '@minecraft/server';
import {
 PEPPER_LEAVES_ID,PEPPER_WORLDGEN_FRUITING_BRIDGE_ID,
 PEPPER_WORLDGEN_FRUITING_COMPONENT_ID,PEPPER_HAS_STATE,PEPPER_PERSISTENT_STATE
} from './pepper_worldgen_fruiting_core.js';

system.beforeEvents.startup.subscribe(event=>{
 event.blockComponentRegistry.registerCustomComponent(PEPPER_WORLDGEN_FRUITING_COMPONENT_ID,{
  onTick(e){
   const block=e.block;
   if(block?.typeId!==PEPPER_WORLDGEN_FRUITING_BRIDGE_ID)return;
   try{
    block.setPermutation(BlockPermutation.resolve(PEPPER_LEAVES_ID,{
     [PEPPER_HAS_STATE]:true,
     [PEPPER_PERSISTENT_STATE]:false
    }));
   }catch{}
  }
 });
});
