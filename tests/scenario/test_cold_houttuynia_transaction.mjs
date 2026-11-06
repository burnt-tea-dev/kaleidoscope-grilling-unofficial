import test from 'node:test';
import assert from 'node:assert/strict';
import {createFixture} from '../helpers/minecraft-fixture.mjs';
const N='kaleidoscope_grilling:',COLD=N+'cold_houttuynia',ROOT=N+'houttuynia';

async function fixture({roots=6,oil=4,full=false}={}){
 // Cookery is an external pack; both of its native pot definitions stack to 1.
 const f=createFixture({itemDefinitions:Object.fromEntries(['oil_pot','oil_pot_filled'].map(id=>
  ['kaleidoscope_cookery:'+id,{'minecraft:max_stack_size':1}]))});
 await f.load('main.js');f.startup();f.flush();
 const pots=await f.load('oil/cookery_oil_pot_adapter.js');
 const snapshot=await f.load('skewer_item_snapshot.js');
 const root=f.item(ROOT,roots,{nameTag:'Original roots',rawLore:[{translate:'test.roots'}]});
 const template=f.item('kaleidoscope_cookery:oil_pot_filled',1,{nameTag:'Original pot',rawLore:[{translate:'test.pot'}],dynamicProperties:{'foreign:batch':'retained'}});
 const pot=pots.buildCookeryOilPot('premium_chili',oil,template);
 assert.ok(pot);
 const p=f.player({main:root,off:pot});p.isSneaking=true;
 if(full)for(let i=1;i<p.inventory.size;i++)p.inventory.setItem(i,f.item('minecraft:stone',64));
 const table=f.block('minecraft:crafting_table',{x:1,y:64,z:0});
 const count=()=>p.inventory.items().filter(x=>x?.typeId===COLD).reduce((n,x)=>n+x.amount,0)+
  f.drops.filter(e=>e.isValid&&e.getComponent('minecraft:item')?.itemStack.typeId===COLD)
   .reduce((n,e)=>n+e.getComponent('minecraft:item').itemStack.amount,0);
 const craft=()=>{
  const event=f.emit('world.beforeEvents.playerInteractWithBlock',{player:p,block:table,itemStack:p.main,blockFace:'Up',isFirstEvent:true,cancel:false});
  assert.equal(event.cancel,true);f.tick(2);
 };
 return Object.assign(f,{p,pots,snapshot,craft,count});
}

test('registered cold-houttuynia craft consumes three roots and two oil points once, preserving metadata',async t=>{
 const f=await fixture();t.after(()=>f.dispose());
 const before=f.snapshot.captureSkewerMetadata(f.p.main);
 f.craft();
 assert.equal(f.count(),1);assert.equal(f.p.main.amount,3);
 assert.deepEqual(f.snapshot.captureSkewerMetadata(f.p.main),before);
 assert.equal(f.p.off.nameTag,'Original pot');
 assert.equal(f.p.off.getDynamicProperty('foreign:batch'),'retained');
 assert.ok(f.p.off.getRawLore().some(x=>x.translate==='test.pot'));
 assert.equal(f.pots.readCookeryOilPot(f.p.off).count,2);
});

test('the final three roots free the main slot for one output and retain the empty oil-pot metadata',async t=>{
 const f=await fixture({roots:3,oil:2,full:true});t.after(()=>f.dispose());
 f.craft();
 assert.equal(f.count(),1);assert.equal(f.p.main.typeId,COLD);
 assert.equal(f.p.off.typeId,'kaleidoscope_cookery:oil_pot');
 assert.equal(f.p.off.nameTag,'Original pot');
 assert.equal(f.p.off.getDynamicProperty('foreign:batch'),'retained');
 assert.equal(f.drops.length,0);
});

test('a full inventory delivers one cold dish without replacing unrelated items',async t=>{
 const f=await fixture({full:true});t.after(()=>f.dispose());
 const stone=f.p.inventory.items().slice(1).map(x=>f.snapshot.captureSkewerMetadata(x));
 f.craft();
 assert.equal(f.count(),1);assert.equal(f.drops.length,1);
 assert.deepEqual(f.p.inventory.items().slice(1).map(x=>f.snapshot.captureSkewerMetadata(x)),stone);
 assert.equal(f.p.main.amount,3);assert.equal(f.pots.readCookeryOilPot(f.p.off).count,2);
});

test('an output inventory write that applies before throwing is recovered before refunding the ingredients',async t=>{
 const f=await fixture();t.after(()=>f.dispose());
 const root=f.snapshot.captureSkewerMetadata(f.p.main),pot=f.snapshot.captureSkewerMetadata(f.p.off);
 f.faults.failNext(f.p.inventory,'setItem',{phase:'after',predicate:(_slot,stack)=>stack?.typeId===COLD});
 f.craft();
 assert.equal(f.count(),0,'no second output may be dropped after an ambiguous inventory write');
 assert.equal(f.p.main.amount,6);assert.deepEqual(f.snapshot.captureSkewerMetadata(f.p.main),root);
 assert.deepEqual(f.snapshot.captureSkewerMetadata(f.p.off),pot);
 f.craft();assert.equal(f.count(),1,'a confirmed rollback permits one subsequent craft');
});

test('an uncertain full-inventory drop is not spawned again or paid for by refunded ingredients',async t=>{
 const f=await fixture({full:true});t.after(()=>f.dispose());
 f.faults.failNext(f.dimension,'spawnItem',{phase:'after',predicate:stack=>stack?.typeId===COLD});
 f.craft();
 assert.equal(f.count(),1);assert.equal(f.p.main.amount,3);assert.equal(f.pots.readCookeryOilPot(f.p.off).count,2);
 f.craft();
 assert.equal(f.count(),1,'an unconfirmed transaction cannot be retried');
 assert.equal(f.p.main.amount,3);assert.equal(f.pots.readCookeryOilPot(f.p.off).count,2);
});
