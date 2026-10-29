import {system} from '@minecraft/server';
import {applyParityRegistration} from './parity_contract.js';
import {onScriptEvent} from './events.js';

function payload(message){try{const value=JSON.parse(String(message??''));return value&&typeof value==='object'?value:null}catch{return null}}
function receive(event){
 if(event.sourceType!=='Server'||typeof event.message!=='string'||event.message.length>8192)return;
 const kind=event.id==='kaleidoscope_grilling:register_smoking'?'smoking':
  event.id==='kaleidoscope_grilling:register_food_finish'?'food_finish':'';
 if(!kind)return;
 const body=payload(event.message);
 if(!body||!applyParityRegistration(kind,body))
  console.warn('[Grilling parity] rejected '+event.id+' registration');
}
// Some pure/runtime hosts omit native Script Events entirely.
const signal=system.afterEvents.scriptEventReceive;
if(typeof signal?.subscribe==='function')onScriptEvent('parity-registration',receive);
