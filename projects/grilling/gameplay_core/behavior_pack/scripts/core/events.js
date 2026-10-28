import {world} from '@minecraft/server';

const interactions=[];

/** An accepted gesture has one writer; visual/inventory observers run afterwards. */
export function onBlockInteraction(id,handle,{priority=0,blocks,observe=false}={}){
 if(interactions.some(route=>route.id===id))throw Error('Duplicate block interaction owner: '+id);
 interactions.push({id,handle,priority,blocks:blocks&&new Set(blocks),observe});
 interactions.sort((a,b)=>a.priority-b.priority);
}

world.beforeEvents.playerInteractWithBlock.subscribe(event=>{
 const targets=interactions.filter(route=>!route.blocks||route.blocks.has(event.block?.typeId));
 for(const route of targets){
  if(route.observe)continue;
  if(event.cancel)break;
  try{route.handle(event);}catch(error){console.warn('[Grilling interaction '+route.id+'] '+error);}
 }
 for(const route of targets)if(route.observe){
  try{route.handle(event);}catch(error){console.warn('[Grilling observer '+route.id+'] '+error);}
 }
});
