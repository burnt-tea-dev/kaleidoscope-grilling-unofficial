import test from 'node:test';
import assert from 'node:assert/strict';
import * as lore from '../../projects/grilling/gameplay_core/behavior_pack/scripts/bottle_lore_core.js';
import {seasoningLore} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/localized_lore_core.js';
const old=seasoningLore(undefined,3,{pending:true}),fresh=seasoningLore(undefined,8,{pending:true});

test('owned identification never strips mixed or unknown custom messages',()=>{
 const owned=old[0];for(const line of [{rawtext:[{text:'prefix'},owned]},{rawtext:[owned,{text:'suffix'}]},{translate:owned.translate,text:'custom'}, {rawtext:[owned],text:'custom'}, {rawtext:[{translate:owned.translate,with:{rawtext:[{translate:'custom.argument'}]}}]}])assert.equal(lore.isOwnedBottleLore(line),false);
 assert.equal(lore.isOwnedBottleLore({rawtext:[{rawtext:[owned]}]}),true);
});
test('semantic signatures preserve argument/line order, translation identity and unknown structure',()=>{
 const good=fresh;for(const bad of [[...fresh].reverse(),seasoningLore(undefined,7,{pending:true}),[{...fresh[0],translate:'other'},fresh[1]],[{...fresh[0],with:['8','7']},fresh[1]],[{rawtext:[fresh[0],{text:'extra'}]},fresh[1]]])assert.notEqual(lore.bottleLoreSignature(good),lore.bottleLoreSignature(bad));
 assert.equal(lore.bottleLoreSignature([{text:'x'}]),lore.bottleLoreSignature(['x']));assert.equal(lore.bottleLoreSignature([{rawtext:[fresh[0]]}]),lore.bottleLoreSignature([fresh[0]]));
});
test('mismatch diagnostics never contain custom text or metadata values',()=>{
 const message=lore.bottleLoreMismatch([{text:'private text'}],[{text:'private other'}]);assert.equal(message,'line 0 (object -> object)');assert.ok(!message.includes('private'));
});
test('argument order, unknown extra keys and literal values remain fail-closed',()=>{
 const translation={translate:'custom.key',with:['first','second']};assert.notEqual(lore.bottleLoreSignature([translation]),lore.bottleLoreSignature([{...translation,with:['second','first']}]));
 const extra={rawtext:[old[0]],unknown:'retained'};assert.equal(lore.isOwnedBottleLore(extra),false);assert.notEqual(lore.bottleLoreSignature([extra]),lore.bottleLoreSignature([{rawtext:[old[0]]}]));
 assert.equal(lore.bottleLoreSignature(['custom']),lore.bottleLoreSignature([{text:'custom'}]));assert.notEqual(lore.bottleLoreSignature(['custom']),lore.bottleLoreSignature([{text:'changed'}]));
});
test('empty and depth-limited wrappers stay unknown rather than becoming owned or equivalent',()=>{
 let within=old[0];for(let i=0;i<15;i++)within={rawtext:[within]};assert.equal(lore.isOwnedBottleLore(within),true);
 const deep={rawtext:[within]};assert.equal(lore.isOwnedBottleLore(deep),false);assert.notEqual(lore.bottleLoreSignature([deep]),lore.bottleLoreSignature([old[0]]));
 const empty={rawtext:[]};assert.equal(lore.isOwnedBottleLore(empty),false);assert.notEqual(lore.bottleLoreSignature([empty]),lore.bottleLoreSignature([{text:''}]));
});
