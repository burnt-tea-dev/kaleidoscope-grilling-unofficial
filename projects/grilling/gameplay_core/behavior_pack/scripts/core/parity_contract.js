// Bedrock parity registry for Java behaviors that cannot be discovered through the stable Script API.
// Java 1.1.1 resolves smoking recipes dynamically and executes each ingredient's finishUsingItem().
// Bedrock has no equivalent recipe-manager/item-finish dispatch surface, so cooperating add-ons may
// register equivalent results at runtime instead of requiring Grilling to hard-code their namespaces.

const ITEM_ID=/^[a-z0-9_.-]+:[a-z0-9_./-]+$/;
const EFFECT_KINDS=new Set(['native','persistent_fx']);
import {DEFAULT_SECRET_SMOKING_ITEMS as DEFAULT_SMOKING_RESULTS,registerSecretSmoking,resolveSecretSmokedId,registerSecretIngredientBehavior,secretIngredientRegistration,resetSecretCompatRegistry} from '../secret_compat_core.js';

function itemId(value){const id=String(value??'');return ITEM_ID.test(id)?id:''}
function effectRow(value){
 if(!value||typeof value!=='object')return null;
 const kind=EFFECT_KINDS.has(value.kind)?value.kind:'native';
 const effect=String(value.effect??'').replace(/^minecraft:/,'');
 if(!/^[a-z0-9_.-]+$/.test(effect))return null;
 const ticks=Math.max(1,Math.min(20*60*60*24,Number(value.ticks)||0))|0;
 const amplifier=Math.max(0,Math.min(255,Number(value.amplifier)||0))|0;
 const chance=Math.max(0,Math.min(1,Number(value.chance??1)));
 if(!ticks)return null;
 return {kind,effect,ticks,amplifier,chance};
}
function cloneBehavior(value){
 if(!value)return undefined;
 return {...value,effects:value.effects.map(x=>({...x}))};
}
function normalizeFinishBehavior(value){
 if(!value||typeof value!=='object')return null;
 const effects=(Array.isArray(value.effects)?value.effects:[]).map(effectRow).filter(Boolean).slice(0,16);
 const convertTo=value.convertTo?itemId(value.convertTo):'';
 if(value.convertTo&&!convertTo)return null;
 return {
  effects,convertTo,
  clearPoison:!!value.clearPoison,
  teleport:!!value.teleport,
  ordinary:!!value.ordinary,
  replaceEffects:!!value.replaceEffects
 };
}

export function registerSmokingResult(input,output){
 const from=itemId(input),to=itemId(output);if(!from||!to)return false;
 return registerSecretSmoking({input:from,output:to});
}
export function resolveSmokingResult(input){return resolveSecretSmokedId(itemId(input))}

export function registerIngredientFinishBehavior(item,behavior){
 const id=itemId(item),clean=normalizeFinishBehavior(behavior);if(!id||!clean)return false;
 return registerSecretIngredientBehavior({input:id,behavior:{...clean,mode:clean.replaceEffects?'replace':'merge'}});
}
export function ingredientFinishBehavior(item){const row=secretIngredientRegistration(itemId(item));return row?{...cloneBehavior(row),replaceEffects:row.mode==='replace'}:undefined}

export function applyParityRegistration(kind,payload){
 if(!payload||typeof payload!=='object')return false;
 if(kind==='smoking')return registerSmokingResult(payload.input,payload.output);
 if(kind==='food_finish')return registerIngredientFinishBehavior(payload.item,payload);
 return false;
}

// Test-only deterministic reset; production callers do not need this.
export function resetParityRegistrationsForTest(){
 resetSecretCompatRegistry();
}
export {DEFAULT_SMOKING_RESULTS};
