import {onScriptEvent} from './core/events.js';
import {system} from '@minecraft/server';
import {
 registerSecretSmoking,registerSecretIngredientBehavior,registerSecretCompatBundle
} from './secret_compat_core.js';

export const SECRET_SMOKING_REGISTER_EVENT='kaleidoscope_grilling:register_secret_smoking';
export const SECRET_BEHAVIOR_REGISTER_EVENT='kaleidoscope_grilling:register_secret_food_behavior';
export const SECRET_BUNDLE_REGISTER_EVENT='kaleidoscope_grilling:register_secret_compat';
export const SECRET_CONSUMED_EVENT='kaleidoscope_grilling:secret_ingredient_consumed';

function payload(message){
 const value=JSON.parse(String(message??'{}'));
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('payload must be a JSON object');
 return value;
}
onScriptEvent('secret_compat_runtime.js:0',event=>{
 if(event.sourceType!=='Server'||typeof event.message!=='string'||event.message.length>8192)return;
 try{
  if(event.id===SECRET_SMOKING_REGISTER_EVENT){
   if(!registerSecretSmoking(payload(event.message)))throw new Error('invalid smoking registration');
  }else if(event.id===SECRET_BEHAVIOR_REGISTER_EVENT){
   if(!registerSecretIngredientBehavior(payload(event.message)))throw new Error('invalid food-behavior registration');
  }else if(event.id===SECRET_BUNDLE_REGISTER_EVENT){
   const value=payload(event.message),result=registerSecretCompatBundle(value);
   if((value.smoking?.length??0)!==result.smoking||(value.behaviors?.length??0)!==result.behaviors)
    throw new Error('bundle contains invalid registrations');
  }
 }catch(error){
  console.warn('[Grilling secret compat] '+event.id+': '+error);
 }
});

export function emitSecretIngredientConsumed(player,row){
 if(!player||!row?.id)return;
 try{
  system.sendScriptEvent(SECRET_CONSUMED_EVENT,JSON.stringify({
   version:1,playerId:String(player.id??''),playerName:String(player.name??''),itemId:String(row.id)
  }));
 }catch{}
}
