import test from 'node:test';
import assert from 'node:assert/strict';
import {heatLore,isHeatLore,HEAT_NAME_KEY} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/localized_lore_core.js';
import {createFixture} from '../helpers/minecraft-fixture.mjs';

test('a delayed heat-lore spawn scan ignores a container invalidated after the event',async()=>{
 const f=createFixture();await f.load('hot_lore_runtime.js');
 const player=f.player(),inventory=player.inventory;
 const size=Object.getOwnPropertyDescriptor(inventory,'size');
 f.emit('world.afterEvents.playerSpawn',{player});
 Object.defineProperty(inventory,'size',{configurable:true,get(){const error=new Error('Player container is no longer valid');error.name='InvalidEntityError';throw error;}});
 assert.doesNotThrow(()=>f.tick());
 Object.defineProperty(inventory,'size',size);
 f.emit('world.afterEvents.playerSpawn',{player});
 assert.doesNotThrow(()=>f.tick());
});
test('one item can display heat in each client language without rewriting metadata',()=>{
 const line=heatLore(65);
 assert.deepEqual(line,{rawtext:[{text:'§c🔥 '},{translate:HEAT_NAME_KEY},{text:' 1:05'}]});
 assert.equal(JSON.stringify(line).includes('煙火氣'),false);assert.equal(isHeatLore(line),true);
});
test('legacy heat lines migrate, foreign translated lore is not removed',()=>{
 assert.equal(isHeatLore('§c🔥 煙火氣 1:00'),true);
 assert.equal(isHeatLore({text:'§c🔥 old'}),true);
 const foreign={rawtext:[{text:'§c🔥 '},{translate:'other:keepsake'}]};
 assert.equal(isHeatLore(foreign),false);
 const lines=[foreign,heatLore(61),{translate:'other:description'}];
 assert.deepEqual(lines.filter(x=>!isHeatLore(x)),[foreign,{translate:'other:description'}]);
});
