import {every,onlinePlayers} from './core/scheduler.js';
import {world,system} from '@minecraft/server';
import {getMainHand,getOffHand} from './a2735_player_io.js';
import {heldVisualKind,writeHeldVisual,forgetHeldVisual,HELD_VISUAL_EMPTY} from './held_visual_transport.js';

// All held-content providers share one player scan and one deduplicated event
// queue. The periodic fallback covers offhand/equipment changes without adding
// another entity or a per-frame server task.
const providers=new Map(),queued=new Map(),errors=new Map();
let scheduled=0,sequence=0,cycle=0;
export function registerHeldVisualProvider(name,sync,{period=5,leave,inventory,hotbar,spawn}={}){
 if(providers.has(name)||!Number.isInteger(period)||period<5||period%5!==0)throw Error('Grilling: invalid held visual provider');
 providers.set(name,{sync,period,leave,inventory,hotbar,spawn});
}
export function reportHeldVisualError(name,player,error){
 const key=name+':'+player.id,tick=system.currentTick;
 if(tick>=(errors.get(key)??-Infinity)){
  errors.set(key,tick+100);console.warn('[Grilling held '+name+'] '+error);
 }
}
function refresh(player,force=false){
 for(const [name,provider] of providers){
  // A runInterval may start at any world tick after a script reload. Schedule
  // relative to this dispatcher instead of requiring worldTick % period == 0.
  if(!force&&cycle%(provider.period/5)!==0)continue;
  try{provider.sync(player)}catch(error){reportHeldVisualError(name,player,error)}
 }
 for(const [hand,read] of [['main',getMainHand],['off',getOffHand]])try{
  if(heldVisualKind(read(player)?.typeId)==='empty')writeHeldVisual(player,hand,'empty',HELD_VISUAL_EMPTY);
 }catch(error){reportHeldVisualError('reset '+hand,player,error)}
}
function flushQueued(){
 scheduled=0;const batch=[...queued.values()];queued.clear();
 for(const current of batch)refresh(current,true);
 return new Set(batch.map(player=>player.id));
}
function enqueue(player){
 queued.set(player.id,player);if(scheduled)return;
 const token=++sequence;scheduled=token;
 try{system.run(()=>{if(scheduled===token)flushQueued()})}
 catch(error){
  // The callback may have been queued before the scheduler threw. Revoke its
  // token and retain the work for a later event or the five-tick fallback.
  if(scheduled===token)scheduled=0;
  reportHeldVisualError('event queue',player,error);
 }
}
world.afterEvents.playerInventoryItemChange.subscribe(e=>{for(const p of providers.values())p.inventory?.(e.player.id);enqueue(e.player)});
world.afterEvents.playerHotbarSelectedSlotChange.subscribe(e=>{for(const p of providers.values())p.hotbar?.(e.player.id);enqueue(e.player)});
world.afterEvents.playerSpawn.subscribe(e=>{
 forgetHeldVisual(e.player.id);for(const p of providers.values())p.spawn?.(e.player.id);enqueue(e.player);
});
world.afterEvents.playerLeave.subscribe(e=>{
 queued.delete(e.playerId);forgetHeldVisual(e.playerId);
 for(const provider of providers.values())provider.leave?.(e.playerId);
 for(const key of errors.keys())if(key.endsWith(':'+e.playerId))errors.delete(key);
});
every('held_visual_dispatch_runtime:1',()=>{
 const refreshed=queued.size?flushQueued():new Set();
 for(const player of onlinePlayers())if(!refreshed.has(player.id))refresh(player);
 cycle++;
},5);
