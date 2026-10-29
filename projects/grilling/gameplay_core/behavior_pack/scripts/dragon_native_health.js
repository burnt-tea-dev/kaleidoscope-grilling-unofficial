import {system} from '@minecraft/server';
import {dragonHealthBonus,dragonHealthGain} from './dragon_health_core.js';
import {PERSISTED_KEY as PersistedKey} from './core/persist_keys.js';
const KEY=PersistedKey.DRAGON_NATIVE_LEVEL;
const pending=new Map();
/** Native max health; damage/healing remains owned by the engine. */
export function nativeDragonHealth(entity,amplifier,{heal=false}={}){
 const level=amplifier===undefined?0:amplifier>0?2:1;
 const old=Number(entity.getDynamicProperty(KEY)??0);
 if(old===level)return false;
 const health=entity.getComponent('minecraft:health');
 if(!health)throw Error('Dragon health component unavailable');
 const gain=dragonHealthGain(old?old-1:undefined,amplifier);
 // The old own ledger identifies a legacy Grilling health_boost. Leave an
 // unrelated or higher-amplifier native effect intact during migration.
 if(!old&&level&&entity.getDynamicProperty(PersistedKey.DRAGON_POOL)!==undefined){
  const legacy=entity.getEffect('health_boost');
  if(legacy?.amplifier===(level===2?1:0))entity.removeEffect('health_boost');
  entity.setDynamicProperty(PersistedKey.DRAGON_POOL,undefined);
 }
 entity.triggerEvent(PersistedKey.DRAGON_HEALTH_PREFIX+level);
 entity.setDynamicProperty(KEY,level||undefined);
 // Component-group health.value is the native default/max attribute. The
 // engine preserves current HP. Heal after that event by the Java difference.
 // Preserve an unapplied first heal when another upgrade arrives this tick.
 // Clearing the effect cancels it; same-level refresh returns above unchanged.
 const token={gain:Math.min(dragonHealthBonus(amplifier),(heal?gain:0)+(level?(pending.get(entity.id)?.gain??0):0))};pending.set(entity.id,token);
 system.run(()=>{
  if(pending.get(entity.id)!==token)return;
  pending.delete(entity.id);
  try{const hp=entity.getComponent('minecraft:health');
   if(hp.currentValue<=hp.effectiveMin)return;
   hp.setCurrentValue(Math.min(hp.effectiveMax,hp.currentValue+token.gain));
  }catch(error){console.warn('[Grilling native dragon health] '+error)}
 });
 return true;
}
export function forgetDragonHealth(entityId){pending.delete(entityId);}
