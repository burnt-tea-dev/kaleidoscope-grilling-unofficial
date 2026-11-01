import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {defaultFixture as f} from '../../helpers/register-minecraft-loader.mjs';

test('instrumented G206 observer logs both real cache rows, frame, lore and direct readable properties',async()=>{
 const pack=process.env.HELD_STATUS_QA_PACK;
 assert.ok(pack,'HELD_STATUS_QA_PACK must point at an instrumented isolated BP UUID directory');
 const runtime=await import(pathToFileURL(`${pack}/scripts/held_visual_transport.js`).href);
 assert.throws(()=>f.world.afterEvents.scriptEventReceive, /belongs to system.afterEvents/);
 const player=f.player({id:'qa-human',name:'QA Human'});
 const makeItem=(name,key,value)=>{const stack=new f.ItemStack('kaleidoscope_grilling:skewer_plate',1);stack.nameTag=name;stack.setLore(['human visible lore']);stack.setDynamicProperty(key,value);return stack;};
 player.main=makeItem('main plate','qa:foreign','main-mark');
 player.off=makeItem('off plate','kaleidoscope_grilling:sample','off-mark');
 const main=[11,12,13,14,15,16,17,18,19,20,1,255];
 const off=[21,22,23,24,25,26,27,28,29,30,2,255];
 runtime.writeHeldVisual(player,'main','plate',main);runtime.writeHeldVisual(player,'off','plate',off);
 runtime.flushHeldVisual(player,314);
 f.emit('system.afterEvents.scriptEventReceive',{id:'kg_held_qa:status',message:'QA Human'});
 const line=f.logs.find(row=>row.text.includes('[kg_held_qa]'))?.text;
 assert.ok(line,'observer should log to server console');
 const value=JSON.parse(line.slice(line.indexOf('{')));
 assert.equal(value.frame,1);assert.deepEqual(value.main.transport.words,main);assert.deepEqual(value.off.transport.words,off);
 assert.deepEqual(value.main.item.lore,['human visible lore']);assert.deepEqual(value.off.item.lore,['human visible lore']);
 assert.equal(value.main.item.dynamicProperties['qa:foreign'],'main-mark');
 assert.equal(value.off.item.dynamicProperties['kaleidoscope_grilling:sample'],'off-mark');
 assert.equal(value.main.item.rawLoreSupported,true);assert.equal(value.rendererAcknowledged,false);
});
