import test from 'node:test';
import assert from 'node:assert/strict';
import * as tx from '../../projects/grilling/gameplay_core/behavior_pack/scripts/plate_transaction_core.js';
import * as support from '../../projects/grilling/gameplay_core/behavior_pack/scripts/blockSupport.js';

test('invalid saved rows are rejected, never filtered or truncated',()=>{
 for(const raw of [null,1,'{',JSON.stringify({}),JSON.stringify([null]),JSON.stringify([{id:'bad'}]),JSON.stringify([{id:'x:food',native:{version:2,id:'x:food'}}]),JSON.stringify([{id:'x:food',native:{version:1,id:'x:other'}}]),JSON.stringify(Array(6).fill({id:'x:food'}))])assert.throws(()=>tx.decodePlateStorage(raw));
 assert.deepEqual(tx.decodePlateStorage(undefined),[]);
});
test('placement uses Java player direction, including wrap and exact quarter-turn boundaries',()=>{
 for(const [yaw,expected] of [[0,'south'],[90,'west'],[180,'north'],[-90,'east'],[360,'south'],[45,'west'],[-45,'south'],[-135,'east']])assert.equal(tx.plateFacingFromYaw(yaw),expected);
 assert.throws(()=>tx.plateFacingFromYaw(NaN));
});
test('pre-write conflict preserves changed input instead of rolling it back',()=>{
 let value='other';const step=tx.verifiedPlateStep({read:()=>value,write:v=>{value=v},before:'old',after:'new'});
 assert.equal(tx.commitPlateSteps([step],()=>assert.fail()).ok,false);assert.equal(value,'other');
});

test('full-cube admission distinguishes known partial blocks from positive shape families and unknown geometry',()=>{
 const block=(name,states={})=>({typeId:name.includes(':')?name:'minecraft:'+name,permutation:{getAllStates:()=>states}});
 for(const name of ['azalea','flowering_azalea','pink_petals','wildflowers','leaf_litter','tripwire_hook','powered_repeater','unpowered_repeater','powered_comparator','unpowered_comparator','snow_layer','honey_block','decorated_pot'])assert.equal(support.hasFullCubeCollision(block(name)),false,name);
 for(const name of ['stone','oak_planks','mushroom_stem','red_mushroom_block','grass_block','muddy_mangrove_roots','oak_double_slab','kaleidoscope_grilling:pepper_log','copper_block','cut_copper','exposed_copper','weathered_copper','oxidized_copper','waxed_exposed_cut_copper','waxed_weathered_chiseled_copper'])assert.equal(support.hasFullCubeCollision(block(name)),true,name);
 for(const name of ['foreign:solid_looking_block','future_vanilla_shape','piston'])assert.equal(support.hasFullCubeCollision(block(name)),undefined,name);
});
test('stair support uses high face and resolved corners for all four facings, in both vertical halves',()=>{
 const faces=['east','west','south','north'],left={east:'north',west:'south',south:'east',north:'west'},right={east:'south',west:'north',south:'west',north:'east'};
 for(let value=0;value<4;value++)for(const top of [false,true])for(const corner of ['none','inner_left','inner_right','outer_left','outer_right']){
  const block={typeId:'minecraft:oak_stairs',permutation:{getAllStates:()=>({weirdo_direction:value,upside_down_bit:top,'minecraft:corner':corner})}};
  for(const side of faces)assert.equal(support.hasSturdySide(block,side),corner.startsWith('outer_')?false:side===faces[value]||(corner==='inner_left'&&side===left[faces[value]])||(corner==='inner_right'&&side===right[faces[value]]),[value,top,corner,side].join('/'));
 }
});
test('wall support follows Java support shape exceptions without weakening plate collision admission',()=>{
 const block=name=>({typeId:name.includes(':')?name:'minecraft:'+name,permutation:{getAllStates:()=>({})}});
 for(const [name,collision,sturdy] of [['oak_leaves',true,false],['soul_sand',false,true],['composter',false,true],['glass',true,true],['ice',true,true],['cauldron',false,false],['water_cauldron',false,false],['lava_cauldron',false,false],['kaleidoscope_grilling:pepper_leaves',false,false],['kaleidoscope_grilling:pepper_log',true,true]]){
  assert.equal(support.hasFullCubeCollision(block(name)),collision,name);
  for(const side of ['north','south','west','east'])assert.equal(support.hasSturdySide(block(name),side),sturdy,name+'/'+side);
 }
});
test('closed trapdoors have no sturdy horizontal face; open trapdoors expose only the outside face',()=>{
 const facing=['south','west','north','east'],outside=['north','east','south','west'];
 for(const id of ['minecraft:trapdoor','minecraft:iron_trapdoor','minecraft:waxed_copper_trapdoor'])for(let direction=0;direction<4;direction++)for(const open of [false,true])for(const top of [false,true]){
  const block={typeId:id,permutation:{getAllStates:()=>({direction,open_bit:open,upside_down_bit:top})}};
  assert.equal(support.hasFullCubeCollision(block),false);
  for(const side of facing)assert.equal(support.hasSturdySide(block,side),open&&side===outside[direction],[id,direction,open,top,side].join('/'));
 }
 for(const states of [{open_bit:true},{open_bit:true,direction:4},{direction:0}])assert.equal(support.hasSturdySide({typeId:'minecraft:trapdoor',permutation:{getAllStates:()=>states}},'north'),undefined);
});
for(const failure of ['throw','false'])test(`unchanged rejected write ${failure} requires no rollback write or quarantine`,()=>{
 let value={id:'before',metadata:{lore:['kept']}},writes=0;const before=structuredClone(value);
 const step=tx.verifiedPlateStep({read:()=>value,write(){writes++;if(failure==='throw')throw Error('before mutation');return false},before,after:{id:'after'}});
 const result=tx.commitPlateSteps([step],()=>assert.fail('confirmed unchanged state must not quarantine'));
 assert.equal(result.ok,false);assert.equal(result.rollbackErrors,0);assert.equal(writes,1);assert.deepEqual(value,before);
});
for(const outcome of ['void','false','throw'])test(`owned postimage restores exact preimage despite native rollback ${outcome}`,()=>{
 const before={id:'same',amount:2,metadata:{lore:[{translate:'foreign',with:['kept']}],properties:{x:4}}},after={...before,amount:1};let value=structuredClone(before),writes=0;
 const step=tx.verifiedPlateStep({read:()=>value,before,after,write(v){value=structuredClone(v);writes++;if(writes===1)throw Error('applied before throw');if(outcome==='throw')throw Error('restored before throw');if(outcome==='false')return false}});
 const result=tx.commitPlateSteps([step],()=>assert.fail('exact restoration is acknowledged'));
 assert.equal(result.ok,false);assert.equal(result.rollbackErrors,0);assert.deepEqual(value,before);assert.equal(writes,2);
});
for(const mutation of ['id','amount','name','lore','property'])test(`foreign ${mutation} after throw is preserved and earlier debit remains quarantined`,()=>{
 const before={id:'food',amount:1,name:'original',lore:['original'],properties:{foreign:1}},after={...before,amount:2};let source=1,value=structuredClone(before),writes=0,quarantines=0;
 const foreign=structuredClone(after);if(mutation==='property')foreign.properties.foreign=2;else if(mutation==='lore')foreign.lore=['replacement'];else foreign[mutation]=mutation==='amount'?9:'replacement';
 const debit=tx.verifiedPlateStep({read:()=>source,write:v=>{source=v},before:1,after:0});
 const credit=tx.verifiedPlateStep({read:()=>value,before,after,write(){writes++;value=foreign;throw Error('foreign postimage')}});
 assert.throws(()=>tx.commitPlateSteps([debit,credit],()=>quarantines++),/recovery required/);
 assert.equal(source,0,'uncertain credit cannot refund source');assert.equal(value,foreign);assert.equal(writes,1);assert.equal(quarantines,1);
});
test('unreadable rollback state retains debit and quarantines without another write',()=>{
 let source=1,unknown=false,writes=0,quarantines=0;
 const debit=tx.verifiedPlateStep({read:()=>source,write:v=>{source=v},before:1,after:0});
 const credit=tx.verifiedPlateStep({read(){if(unknown)throw Error('unreadable');return 0},write(){writes++;unknown=true;throw Error('unknown credit')},before:0,after:1});
 assert.throws(()=>tx.commitPlateSteps([debit,credit],()=>quarantines++),/recovery required/);assert.equal(source,0);assert.equal(writes,1);assert.equal(quarantines,1);
});
