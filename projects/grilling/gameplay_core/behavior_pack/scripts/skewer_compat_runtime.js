import {onScriptEvent} from './core/events.js';
import {system} from '@minecraft/server';
import {SKEWER_COMPAT_REGISTER_EVENT,registerSkewerCompatBundle} from './skewer_compat_core.js';

onScriptEvent('skewer_compat_runtime.js:0',event=>{
 if(event.sourceType!=='Server'||typeof event.message!=='string'||event.message.length>8192)return;
 if(event.id!==SKEWER_COMPAT_REGISTER_EVENT)return;
 try{
  const payload=JSON.parse(String(event.message??'{}'));
  const expectedRules=Array.isArray(payload?.ingredientRules)?payload.ingredientRules.length:0;
  const expectedCooking=Array.isArray(payload?.cooking)?payload.cooking.length:0;
  const result=registerSkewerCompatBundle(payload);
  if(result.ingredientRules!==expectedRules||result.cooking!==expectedCooking)
   throw new Error('bundle contains invalid skewer compatibility rules');
 }catch(error){console.warn('[Grilling skewer compat] '+error)}
});
