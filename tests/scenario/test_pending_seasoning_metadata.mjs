import assert from 'node:assert/strict';
import test from 'node:test';
import {createFixture} from '../helpers/minecraft-fixture.mjs';
const N='kaleidoscope_grilling:';
test('pending completion retains original native metadata',async t=>{
 const f=createFixture();t.after(()=>f.dispose());await f.load('main.js');f.startup();f.tick(1);
 const data=await f.load('core/persist.js'),food=await f.load('food/food_state_adapter.js');
 const stack=f.item(N+'pending_seasoning_f3',1,{nameTag:'Owned bottle',keepOnDeath:true,lockMode:'slot',canDestroy:['minecraft:stone'],canPlaceOn:['minecraft:dirt'],rawLore:[{text:'foreign retained'}]});
 data.setItemProperty(stack,'foreign:owner','retained');food.setFoodSeasonings(stack,[N+'green_chili_powder',N+'sichuan_pepper',N+'onion_powder']);
 const p=f.player({main:stack});
 f.emit('world.afterEvents.itemStartUse',{source:p,itemStack:p.main.clone(),useDuration:80});
 f.tick(80);f.emit('world.afterEvents.itemCompleteUse',{source:p,itemStack:p.main.clone(),useDuration:0});
 const actual=p.main;
 assert.ok(actual?.typeId.startsWith(N+'special_seasoning'),'completion reached SPECIAL identity');
 const envelope=s=>({name:s.nameTag,keepOnDeath:s.keepOnDeath,lockMode:s.lockMode,canDestroy:s.getCanDestroy(),canPlaceOn:s.getCanPlaceOn(),foreign:data.getItemProperty(s,'foreign:owner'),customLore:s.getRawLore().filter(x=>x.text==='foreign retained')});
 console.log(JSON.stringify({before:envelope(stack),after:envelope(actual)}));
 assert.deepEqual(envelope(actual),envelope(stack));
});
