import {onBeforeBlockBreak,onExplosion} from '../core/events.js';
import {onBlockInteraction} from '../core/events.js';
import {every,onlinePlayers} from '../core/scheduler.js';
import {premiumOilPotInRange,premiumOilPotParticles} from '../oil_ambient_core.js';
import {emitParticles} from '../immersion_particles_runtime.js';
import {world,system} from '@minecraft/server';
import {HOST_BLOCK_ID,typedOilBlockKey} from './typed_oil_pot_block_core.js';
import {COOKERY_FILLED_ID,GRILLING_TYPE_KEY} from './cookery_oil_pot_core.js';
import {readPublicOil} from '../host_api/oil_api_core.js';
import {ensureOilHandPublished} from '../oil_api_client.js';
import {currentPlacedOilPotCandidates,readPlacedOilPotState} from './cookery_oil_pot_block_adapter.js';

const notices=new Map();
function notify(player){
 if(!player)return;
 const last=notices.get(player.id)??-1000;
 if(system.currentTick-last<60)return;
 notices.set(player.id,system.currentTick);
 system.run(()=>{try{console.warn('[Grilling Oil API] typed oil snapshot pending')}catch{}});
}
world.afterEvents.playerLeave.subscribe(e=>notices.delete(e.playerId));
function legacyTypedPot(block){
 if(block?.typeId!==HOST_BLOCK_ID)return false;
 try{
  const p=block.location;
  // This marker belongs to Grilling. It is NOT Cookery's oil quantity.
  const marker=world.getDynamicProperty(typedOilBlockKey(block.dimension.id,p.x,p.y,p.z));
  return marker!==undefined&&marker!==null&&marker!=='';
 }catch{return true;} // unreadable existing state is not an empty container
}
function typedHand(stack){
 if(stack?.typeId!==COOKERY_FILLED_ID)return false;
 if(readPublicOil(stack).source==='public_api')return false;
 try{const type=stack.getDynamicProperty(GRILLING_TYPE_KEY);return type!==undefined&&type!==null&&type!=='';}
 catch{return true;}
}
onBlockInteraction('a2736_typed_oil_pot_block_runtime',e=>{
 // Publish legacy Grilling metadata before permitting a native Cookery placement.
 // Current public API items pass through to the author-owned placement transaction.
 const localOilUse=['kaleidoscope_grilling:grill','kaleidoscope_grilling:oil_press','kaleidoscope_grilling:big_vat'].includes(e.block?.typeId);
 if(legacyTypedPot(e.block)){
  e.cancel=true;system.run(()=>readPlacedOilPotState(e.block));if(e.isFirstEvent!==false)notify(e.player);return;
 }
 if(typedHand(e.itemStack)&&!localOilUse){
  e.cancel=true;system.run(()=>ensureOilHandPublished(e.player,'main',undefined));if(e.isFirstEvent!==false)notify(e.player);
 }
},{"priority":60});
onBeforeBlockBreak('oil/typed_oil_pot_block_runtime.js:0',e=>{
 if(legacyTypedPot(e.block)){e.cancel=true;notify(e.player);}
});
onExplosion('oil/typed_oil_pot_block_runtime.js:0',e=>{
 const impacted=e.getImpactedBlocks(),keep=impacted.filter(block=>!legacyTypedPot(block));
 if(keep.length!==impacted.length)e.setImpactedBlocks(keep);
});
// No cleanup of old properties, block removal, item spawning, or host-state write.
// Command edits and other addons that ignore cancellation cannot be prevented.


// Java samples this independently on each nearby client every eight ticks.
// Use Player.spawnParticle through the existing Molang velocity adapter, so
// overlapping observers neither multiply each other's bursts nor share a draw.
// Discovery comes from the placed renderer/public Oil API, never private data.
every('a2736_typed_oil_pot_block_runtime:1',()=>{
 const players=onlinePlayers();
 for(const station of currentPlacedOilPotCandidates())try{
  const nearby=players.filter(player=>premiumOilPotInRange(station,player));
  if(!nearby.length)continue;
  const block=world.getDimension(station.dimensionId).getBlock(station);
  if(block?.typeId!==HOST_BLOCK_ID)continue;
  const state=readPlacedOilPotState(block);
  if(state?.type!=='premium_chili'||!(state.count>0))continue;
  for(const player of nearby)emitParticles(player,station,premiumOilPotParticles());
 }catch{} // An unloaded target is not authority to modify a block or its oil.
},8);
