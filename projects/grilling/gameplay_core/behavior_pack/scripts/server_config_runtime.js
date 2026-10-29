import {getWorldProperty,setWorldProperty} from './core/persist.js';
import {onScriptEvent} from './core/events.js';
import {world,system,CommandPermissionLevel,CustomCommandParamType,CustomCommandStatus} from '@minecraft/server';
import {normalizeConfig,configValue} from './server_config_core.js';
import {PERSISTED_KEY as PersistedKey} from './core/persist_keys.js';
const KEY=PersistedKey.SERVER_CONFIG;let cache;
export function grillingConfig(){if(!cache){let v;try{v=JSON.parse(getWorldProperty(world,KEY)??'{}')}catch{}cache=normalizeConfig(v)}return cache;}
export function setGrillingConfig(key,value){const next={...grillingConfig(),[key]:configValue(key,value)};setWorldProperty(world,KEY,JSON.stringify(next));cache=next;publishCuisineConfig();return next;}
system.beforeEvents.startup.subscribe(({customCommandRegistry})=>{
 customCommandRegistry.registerCommand({name:'kaleidoscope_grilling:config',description:'Set Grilling server option (saturationMultiplier, fullHungerEating, enableEatingAnimations, enableOilBrushVisuals, interceptCookeryTableWhenPlacingPlate, graphicalEatingHud, enableCookeryFoodHeatAndSeasoning, enableSmeltedFoodHeat, smeltedFoodSeconds, contentsHelpers, fixedGrillHelpers, placedHelpers, contentsTargetsPerTick)',permissionLevel:CommandPermissionLevel.GameDirectors,cheatsRequired:false,mandatoryParameters:[{name:'key',type:CustomCommandParamType.String},{name:'value',type:CustomCommandParamType.String}]},(origin,key,value)=>{
  try{configValue(key,value)}catch(error){return {status:CustomCommandStatus.Failure,message:String(error)}}
  system.run(()=>{try{setGrillingConfig(key,value);origin.sourceEntity?.sendMessage('Grilling '+key+' = '+value)}catch(error){console.warn('[Grilling configuration] '+error)}});
  return {status:CustomCommandStatus.Success};
 });
});

// Host modules have their own world-property scope. Persist their setting through
// the versioned bridge, including a ready handshake after either pack starts.
function publishCuisineConfig(){system.sendScriptEvent('kaleidoscope_cookery:cuisine_config',JSON.stringify({api:1,enabled:grillingConfig().enableCookeryFoodHeatAndSeasoning}));}
onScriptEvent('server_config_runtime.js:0',event=>{if(event.id==='kaleidoscope_grilling:cuisine_config_request')publishCuisineConfig();});
system.run(publishCuisineConfig);
