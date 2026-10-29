import {onScriptEvent} from '../core/events.js';
import {system,ItemTypes} from '@minecraft/server';
import {
 KC_READY_EVENT,KC_PING_EVENT,KC_REGISTER_EVENT,SOURCE,recipesForReady
} from './cookery_host_recipes_core.js';
import {TAVERN_VINEGAR_IDS} from '../food/stockpot_food_core.js';

const registeredPayloads=new Set();

function optionalRecipeItems(){
 const out=[];
 for(const id of TAVERN_VINEGAR_IDS)try{if(ItemTypes.get(id))out.push(id)}catch{}
 return out;
}
function registerReady(info){
 for(const payload of recipesForReady(info,{availableItems:optionalRecipeItems()})){
  const message=JSON.stringify(payload);
  if(registeredPayloads.has(message))continue;
  system.sendScriptEvent(KC_REGISTER_EVENT,message);
  registeredPayloads.add(message);
 }
}

onScriptEvent('recipe/cookery_host_recipes_runtime.js:0',ev=>{
 if(ev.id!==KC_READY_EVENT)return;
 try{registerReady(JSON.parse(String(ev.message??'')))}catch{}
});

system.run(()=>{
 try{system.sendScriptEvent(KC_PING_EVENT,SOURCE)}catch{}
});
