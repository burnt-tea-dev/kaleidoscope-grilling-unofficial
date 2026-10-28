import {system} from '@minecraft/server';
import {WORLDGEN_SEED_COMPONENT_ID} from './pepper_tree_core.js';
import {growPepperWorldgenSeed} from './pepper_tree_runtime.js';

system.beforeEvents.startup.subscribe(event=>{
 event.blockComponentRegistry.registerCustomComponent(WORLDGEN_SEED_COMPONENT_ID,{
  onTick(event){growPepperWorldgenSeed(event.block);}
 });
});
