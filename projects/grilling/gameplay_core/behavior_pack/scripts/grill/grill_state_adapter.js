import {world} from '@minecraft/server';
import {stationContainer} from '../family_station_storage.js';
import {initialState,normalizeState} from '../core_logic.js';

function enc(n){return n<0?'m'+Math.abs(n):'p'+n}

export function grillStateKey(block){
 return 'kaleidoscope_grilling:g_'+block.dimension.id.replace(/[^a-z0-9]/gi,'_')+'_'+enc(block.x)+'_'+enc(block.y)+'_'+enc(block.z);
}

export function readGrillState(block){
 const raw=world.getDynamicProperty(grillStateKey(block));
 if(raw===undefined)return initialState();
 if(typeof raw!=='string')throw new Error('invalid persisted grill state');
 return normalizeState(JSON.parse(raw));
}

export function occupiedGrillSlots(block){
 const c=stationContainer(block);
 if(!c)throw new Error('Grill inventory unavailable; ticking paused');
 // Native occupancy does not clone every ItemStack just to count three slots.
 const empty=c.emptySlotsCount;
 if(c.size!==3||!Number.isInteger(empty)||empty<0||empty>3)throw new Error('Invalid grill inventory occupancy');
 return 3-empty;
}
