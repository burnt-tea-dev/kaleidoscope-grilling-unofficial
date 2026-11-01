import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {defaultFixture as f} from '../../helpers/register-minecraft-loader.mjs';

test('instrumented G194 reads the declared native32 schema and reports no cache frame',async()=>{
 const pack=process.env.HELD_STATUS_QA_PACK;
 assert.ok(pack,'HELD_STATUS_QA_PACK must point at an instrumented isolated G194 BP copy');
 assert.throws(()=>f.world.afterEvents.scriptEventReceive,/belongs to system.afterEvents/);
 const schema=JSON.parse(await readFile(`${pack}/entities/player.json`,'utf8'))['minecraft:entity'].description.properties;
 assert.equal(Object.keys(schema).length,32);
 await import(pathToFileURL(`${pack}/scripts/main.js`).href);
 const player=f.player({id:'qa-g194-human',name:'QA G194 Human'});
 const expected={};let number=17;
 for(const [key,definition] of Object.entries(schema)){
  const value=definition.type==='bool'?true:number++;
  player.setProperty(key,value);expected[key]=value;
 }
 const item=new f.ItemStack('kaleidoscope_grilling:skewer_plate',1);item.nameTag='A plate';item.setLore(['visible A lore']);item.setDynamicProperty('qa:foreign','readable');player.main=item;
 f.emit('system.afterEvents.scriptEventReceive',{id:'kg_held_qa:status',message:'QA G194 Human'});
 const line=f.logs.find(row=>row.text.includes('[kg_held_qa]'))?.text;
 assert.ok(line,'observer should log to server console');
 const value=JSON.parse(line.slice(line.indexOf('{')));
 assert.equal(value.profile,'g194-native32');assert.deepEqual(value.nativeProperties,expected);
 assert.equal(value.frame,null);assert.equal(value.frameSource,null);
 assert.deepEqual(value.transport,{source:'legacy native player properties; no held snapshot cache',words:null});
 assert.deepEqual(value.main.item.lore,['visible A lore']);
 assert.equal(value.main.item.dynamicProperties['qa:foreign'],'readable');
 assert.equal(value.propertySource,'one player.getProperty(key) call for each of the 32 keys declared in the matched G194 entities/player.json');
});
