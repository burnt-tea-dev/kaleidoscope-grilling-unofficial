/** Storage-operation doubles exercise the portable contract; no Minecraft players. */
import test from 'node:test';import assert from 'node:assert/strict';
import {EMPTY_POT,FILLED_POT,readPublicOil,writePublicOil,createPublicOilPot,planPublicOilAddition,planPublicOilConsumption,encodePublicOil,decodePublicOil,OIL_PAYLOAD_PREFIX} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/host_api/oil_api_core.js';
class StoredItem{
 constructor(typeId,amount=1){this.typeId=typeId;this.amount=amount;this.lore=[];this.properties={};}
 getRawLore(){return structuredClone(this.lore)}setLore(v){this.lore=structuredClone(v)}
 clone(){const s=new StoredItem(this.typeId,this.amount);Object.assign(s,structuredClone({...this}));return s;}
}
const state=(type,count,revision=0)=>({v:1,type,count,revision});
test('host 32-point pot is read without the private host property and rejects fluid mixing',()=>{
 const pot=new StoredItem(FILLED_POT);pot.properties.host={kc_oil_count:32};writePublicOil(pot,state('',32));
 assert.equal(readPublicOil(pot).state.count,32);assert.equal(planPublicOilAddition(readPublicOil(pot).state,'canola').reason,'different_content');
 const plan=planPublicOilConsumption(readPublicOil(pot).state,3),next=createPublicOilPot(StoredItem,plan.state.type,plan.state.count,pot,plan.state.revision);
 assert.equal(readPublicOil(next).state.count,29);assert.equal(next.properties.host.kc_oil_count,32,'foreign private bytes preserved and no longer authoritative');
});
for(const type of ['canola','secret_chili','premium_chili'])test(type+' retains identity, supports refill and debit, and exhausts into an empty pot',()=>{
 let pot=createPublicOilPot(StoredItem,type,8);pot.nameTag='my pot';pot.lore.unshift('custom lore');
 const different=planPublicOilAddition(readPublicOil(pot).state,type==='canola'?'secret_chili':'canola',8);assert.equal(different.reason,'different_content');
 const fill=planPublicOilAddition(readPublicOil(pot).state,type,8);assert.equal(fill.state.count,16);
 const consumed=planPublicOilConsumption(fill.state,16);assert.equal(consumed.state.type,'');
 pot=createPublicOilPot(StoredItem,consumed.state.type,0,pot,consumed.state.revision);
 assert.equal(pot.typeId,EMPTY_POT);assert.equal(readPublicOil(pot).state.count,0);assert.equal(pot.nameTag,'my pot');assert(pot.lore.includes('custom lore'));
 const refill=planPublicOilAddition(readPublicOil(pot).state,type,8);assert.equal(refill.ok,true);
});
test('missing, duplicate, corrupted and out-of-range payloads fail closed',()=>{
 const pot=new StoredItem(FILLED_POT);pot.lore=['§7Oil: 32/256'];assert.equal(readPublicOil(pot).valid,false,'display lore cannot authorize a quantity');
 writePublicOil(pot,state('canola',8));const line=pot.lore.at(-1);pot.lore.push(line);assert.equal(readPublicOil(pot).valid,false);
 pot.lore=[line.slice(0,-4)+'§0§r'];assert.equal(readPublicOil(pot).valid,false);
 assert.throws(()=>encodePublicOil(state('canola',65)));assert.throws(()=>encodePublicOil(state('unknown',8)));assert.equal(decodePublicOil(OIL_PAYLOAD_PREFIX+'garbage'),undefined);
});
test('capacity, insufficient debit and lore storage limits retain the original payload',()=>{
 const pot=createPublicOilPot(StoredItem,'canola',63),before=pot.getRawLore();assert.equal(planPublicOilAddition(readPublicOil(pot).state,'canola',8).reason,'full');assert.equal(planPublicOilConsumption(readPublicOil(pot).state,64).reason,'insufficient');assert.deepEqual(pot.getRawLore(),before);
 const full=new StoredItem(EMPTY_POT);full.lore=Array(19).fill('custom');assert.throws(()=>createPublicOilPot(StoredItem,'canola',8,full));assert.equal(full.lore.length,19);
});
