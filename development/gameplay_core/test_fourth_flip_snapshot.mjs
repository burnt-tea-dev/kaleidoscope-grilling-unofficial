import {canonicalFoodId,eatingItemId} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_profile_ids.js';
import {secretEatingRows} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_eating_core.js';
/** Production functions and storage/event doubles; not native player evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as logic from '../../projects/grilling/gameplay_core/behavior_pack/scripts/core_logic.js';
import {SECRET_ID,SECRET_COOKED_KEY,SECRET_COOKED_INGREDIENTS_KEY,SKEWER_INGREDIENTS_KEY,secretFood} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a24_skewering_core.js';
import {registerSecretSmoking,resolveSecretSmokedId,resetSecretCompatRegistry} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_compat_core.js';
import {slotWrite} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/rack_transfer_plan.js';
import {commitSteps} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a277_grill_transaction_core.js';
import {grillVisualStage} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/grill_visual_core.js';
const root=new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/',import.meta.url),source=fs.readFileSync(new URL('main.js',root),'utf8');
function fn(text,name){const start=text.indexOf('function '+name+'(');assert.ok(start>=0,name);let end=text.indexOf('{',start)+1,depth=1;while(depth){const c=text[end++];if(c==='{')depth++;if(c==='}')depth--}return text.slice(start,end)}
class Stack{
 constructor(typeId,amount=1){if(typeId==='fixture:missing')throw Error('missing item');this.typeId=typeId;this.amount=amount;this.props={};this.nameTag='';this.lore=[];this.damage=0;}
 clone(){return Object.assign(new Stack(this.typeId,this.amount),structuredClone({...this}));}
 getComponent(){return undefined;}
}
const rawRows=()=>[{id:'minecraft:beef',nutrition:3,saturation:.3,edible:true,tags:[],native:{version:1,id:'minecraft:beef',name:'named raw beef',damage:4,props:{custom:'retained'}}},{id:'minecraft:carrot',nutrition:3,saturation:.3,edible:true,tags:[]},{id:'fixture:food',nutrition:2,saturation:.2,edible:true,tags:['fixture:food_tag']}];
function skewer(rows=rawRows()){const s=new Stack(SECRET_ID);s.props[SKEWER_INGREDIENTS_KEY]=JSON.stringify(rows);s.props.creator='original creator';s.nameTag='kept skewer name';s.lore=['kept lore'];return s;}
function fixture({flips=3,lit=false,stacks=[skewer(),skewer(),skewer()]}={}){
 resetSecretCompatRegistry();let state={...logic.initialState(),phase:1,flips,heatTicks:1200,lit},fail,failState=false,failMetadata=0,metadataWrites=0,quarantined=false;
 const rows=stacks.map(x=>x?.clone()),sounds=[],notices=[],animations=[],writes=[];
 const container={getItem:i=>rows[i]?.clone(),setItem(i,s){rows[i]=s?.clone();writes.push(i);if(fail?.slot===i){if(!fail.permanent)fail=undefined;throw Error('slot write after mutation')}}};
 const player={playAnimation:()=>animations.push('animation')},block={isValid:true,typeId:'fixture:grill'};
 const ctx=vm.createContext({secretEatingRows,canonicalFoodId,...logic,SECRET_ID,SECRET_COOKED_KEY,SECRET_COOKED_INGREDIENTS_KEY,SKEWER_INGREDIENTS_KEY,GRILL_ID:'fixture:grill',COOKERY_FILLED:'fixture:oil',OIL_TOOLS:{},FOOD_DATA:{},RAW_TO_COOKED:{},MYSTERIOUS_ID:'fixture:mystery',ItemStack:Stack,slotWrite,commitSteps,resolveSecretSmokedId,secretFood,
  getItemProperty:(s,k)=>s.props[k],setItemProperty(s,k,v){s.props[k]=v;if(k===SECRET_COOKED_INGREDIENTS_KEY&&++metadataWrites===failMetadata)throw Error('metadata write after mutation')},
  ingredientSnapshot:s=>({id:s.typeId,nutrition:6,saturation:.6,edible:s.typeId!=='minecraft:stone',tags:[],native:{version:1,id:s.typeId,name:s.nameTag,damage:s.damage,props:structuredClone(s.props)}}),
  copyOne:s=>{const next=s.clone();next.amount=1;return next},setHot:s=>s.props.hot=true,setSeasonings:(s,a)=>s.props.seasonings=[...a],refreshHotLore:s=>s,
  readState:()=>structuredClone(state),writeState(_b,s){state=structuredClone(s);if(failState){failState=false;throw Error('state write after mutation')}},inv:()=>container,occupied:()=>rows.filter(Boolean).length,heldByHand:()=>undefined,isExtinguishTool:()=>false,isSpecialSeasoningId:()=>false,
  blockSound:(_b,id)=>sounds.push(id),javaInteractionFeedback:(_p,k)=>notices.push(k),interactionFailure:()=>notices.push('failure'),message(){},quarantineStation:()=>quarantined=true,console:{warn(){}}
 });
 const transfer=fs.readFileSync(new URL('grill_transfer.js',root),'utf8').replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
 vm.runInContext(transfer,ctx);
 const names=['readRowsFromKey','readSkewerRows','validSecretIngredientRows','isSecretCooked','readEffectiveSkewerRows','cookedIngredientRows','setCookedIngredientRows','secretEatingData','dynamicFood','cookedStack','handleGrill'];
 if(source.includes('function commitGrillFlip('))names.push('commitGrillFlip');
 vm.runInContext(names.map(n=>fn(source,n)).join('\n'),ctx);
 return {ctx,rows,sounds,notices,animations,writes,block,player,get state(){return state},get metadataWrites(){return metadataWrites},get quarantined(){return quarantined},run:()=>ctx.handleGrill(block,player),failSlot(slot,permanent=false){fail={slot,permanent}},failState(){failState=true},failMetadata(n=1){failMetadata=n},get cached(){return rows.map(s=>s?.props[SECRET_COOKED_INGREDIENTS_KEY])},cooked:s=>ctx.cookedStack(s,state),visual(s,prefer){return Array.from(ctx.readEffectiveSkewerRows(s,prefer),row=>row.id)}};
}
test('first three flips never create the cooked ingredient cache',()=>{for(const flips of [0,1,2]){const f=fixture({flips});f.run();assert.equal(f.state.flips,flips+1);assert.equal(f.metadataWrites,0);assert(f.cached.every(x=>x===undefined));}});
test('fourth flip snapshots all secret slots even while unlit, without finishing the item',()=>{
 const f=fixture(),before=f.rows.map(x=>x.clone());f.run();assert.equal(f.state.phase,2);assert.equal(f.state.flips,4);assert.equal(f.metadataWrites,3);
 for(let i=0;i<3;i++){const s=f.rows[i],cache=JSON.parse(s.props[SECRET_COOKED_INGREDIENTS_KEY]);assert.equal(cache[0].id,'minecraft:cooked_beef');assert.equal(s.props[SKEWER_INGREDIENTS_KEY],before[i].props[SKEWER_INGREDIENTS_KEY]);assert.equal(s.props.creator,before[i].props.creator);assert.equal(s.nameTag,before[i].nameTag);assert.equal(s.props[SECRET_COOKED_KEY],undefined);assert.equal(s.props.hot,undefined);assert.equal(s.props.seasonings,undefined);}
 assert.deepEqual(f.sounds,['grill_flip']);assert.equal(f.animations.length,1);
});
test('mixed fixed and empty slots are never rewritten by the secret snapshot',()=>{const fixed=new Stack('fixture:fixed'),f=fixture({stacks:[fixed,skewer(),undefined]});f.run();assert.deepEqual(f.writes,[1]);assert.deepEqual(f.rows[0],fixed);assert.equal(f.rows[2],undefined);});
test('third-flip display stays raw without a cache; existing cache remains stage-sensitive',()=>{
 const f=fixture({flips:2});f.run();assert.equal(grillVisualStage(f.state),4);assert.deepEqual(f.visual(f.rows[0],true),['minecraft:beef','minecraft:carrot','fixture:food']);
 const saved=skewer();saved.props[SECRET_COOKED_INGREDIENTS_KEY]=JSON.stringify([{id:'fixture:old_a'},{id:'fixture:old_b'},{id:'fixture:old_c'}]);assert.deepEqual(f.visual(saved,true),['fixture:old_a','fixture:old_b','fixture:old_c']);assert.deepEqual(f.visual(saved,false),['minecraft:beef','minecraft:carrot','fixture:food']);
 saved.props[SECRET_COOKED_KEY]=true;assert.deepEqual(f.visual(saved,undefined),['fixture:old_a','fixture:old_b','fixture:old_c']);assert.deepEqual(f.visual(saved,false),['minecraft:beef','minecraft:carrot','fixture:food']);
});
test('registry changes after cooking cannot alter display, extraction or nutrition',()=>{
 const f=fixture();registerSecretSmoking({input:'fixture:food',output:'fixture:cooked_a'});f.run();const cache=f.cached[0],first=f.cooked(f.rows[0]),nutrition=f.ctx.dynamicFood(first);
 registerSecretSmoking({input:'fixture:food',output:'fixture:cooked_b'});registerSecretSmoking({input:'minecraft:beef',output:'minecraft:stone'});
 assert.deepEqual(f.visual(f.rows[0],true),['minecraft:cooked_beef','minecraft:carrot','fixture:cooked_a']);const later=f.cooked(f.rows[0]);assert.equal(later.props[SECRET_COOKED_INGREDIENTS_KEY],cache);assert.deepEqual(f.ctx.dynamicFood(later),nutrition);
});
test('existing cooked cache survives recooking without recomputation',()=>{const s=skewer();const cache=JSON.stringify([{id:'fixture:old_a'},{id:'fixture:old_b'},{id:'fixture:old_c'}]);s.props[SECRET_COOKED_INGREDIENTS_KEY]=cache;const f=fixture({stacks:[s]});f.run();assert.equal(f.rows[0].props[SECRET_COOKED_INGREDIENTS_KEY],cache);assert.equal(f.metadataWrites,0);});
test('tag conversions work but explicit item registrations retain priority',()=>{const f=fixture();registerSecretSmoking({tag:'fixture:food_tag',output:'fixture:tagged'});f.run();assert.equal(JSON.parse(f.cached[0])[2].id,'fixture:tagged');const g=fixture();registerSecretSmoking({tag:'fixture:food_tag',output:'fixture:tagged'});registerSecretSmoking({input:'fixture:food',output:'fixture:explicit'});g.run();assert.equal(JSON.parse(g.cached[0])[2].id,'fixture:explicit');});
test('invalid or non-food smoking outputs preserve full original ingredient snapshots',()=>{for(const output of ['fixture:missing','minecraft:stone']){const f=fixture();registerSecretSmoking({input:'minecraft:beef',output});f.run();assert.deepEqual(JSON.parse(f.cached[0])[0],rawRows()[0]);}});
for(const slot of [0,1,2])test('slot '+slot+' mutation failure rolls back all items and phase',()=>{const f=fixture(),before=f.rows.map(x=>x.clone());f.failSlot(slot);f.run();assert.equal(f.state.phase,1);assert.equal(f.state.flips,3);assert.deepEqual(f.rows,before);assert.deepEqual(f.sounds,[]);assert.deepEqual(f.animations,[]);assert(f.notices.includes('failure'));});
test('state write after mutation rolls back every prepared snapshot',()=>{const f=fixture(),before=f.rows.map(x=>x.clone());f.failState();f.run();assert.equal(f.state.phase,1);assert.deepEqual(f.rows,before);assert.equal(f.sounds.length,0);});
test('preparation failure commits no slot or phase',()=>{const f=fixture();f.failMetadata(2);f.run();assert.equal(f.state.phase,1);assert.equal(f.writes.length,0);assert(f.cached.every(x=>x===undefined));assert.equal(f.sounds.length,0);});
test('partial or malformed cooked caches fail closed instead of being silently replaced',()=>{for(const cache of ['not json','[]','[{"id":"fixture:partial"}]']){const s=skewer();s.props[SECRET_COOKED_INGREDIENTS_KEY]=cache;const f=fixture({stacks:[s]});f.run();assert.equal(f.state.phase,1);assert.equal(f.rows[0].props[SECRET_COOKED_INGREDIENTS_KEY],cache);assert.equal(f.sounds.length,0);}});
test('incomplete rollback quarantines the station and suppresses success effects',()=>{const f=fixture();f.failSlot(1,true);f.run();assert.equal(f.quarantined,true);assert.equal(f.sounds.length,0);assert.equal(f.animations.length,0);});
test('legacy completed station still creates a cache at extraction and leaves source unchanged',()=>{const f=fixture(),raw=skewer(),out=f.cooked(raw);assert.equal(out.props[SECRET_COOKED_KEY],true);assert.equal(JSON.parse(out.props[SECRET_COOKED_INGREDIENTS_KEY])[0].id,'minecraft:cooked_beef');assert.equal(raw.props[SECRET_COOKED_INGREDIENTS_KEY],undefined);});
test('serialized snapshot remains unchanged after restoration and rule replacement',()=>{const f=fixture();f.run();const restored=Object.assign(new Stack(SECRET_ID),JSON.parse(JSON.stringify(f.rows[0]))),cache=restored.props[SECRET_COOKED_INGREDIENTS_KEY];registerSecretSmoking({input:'minecraft:beef',output:'fixture:changed'});assert.equal(f.cooked(restored).props[SECRET_COOKED_INGREDIENTS_KEY],cache);});

for(const row of [{id:'not-an-item'},{id:'fixture:a',native:{version:1,id:'fixture:wrong'}},{id:'fixture:a',native:{version:2,id:'fixture:a'}}])test('three-row malformed cache refuses '+JSON.stringify(row),()=>{const s=skewer(),cache=JSON.stringify([row,{id:'fixture:b'},{id:'fixture:c'}]);s.props[SECRET_COOKED_INGREDIENTS_KEY]=cache;const f=fixture({stacks:[s]});f.run();assert.equal(f.state.phase,1);assert.equal(f.writes.length,0);assert.equal(f.rows[0].props[SECRET_COOKED_INGREDIENTS_KEY],cache);assert.equal(f.sounds.length,0);});
test('malformed raw native identity refuses snapshot preparation',()=>{const rows=rawRows();rows[0].native.id='fixture:other';const f=fixture({stacks:[skewer(rows)]});f.run();assert.equal(f.state.phase,1);assert.equal(f.writes.length,0);assert.equal(f.sounds.length,0);});
test('invalid newly generated cooked snapshot refuses preparation',()=>{const f=fixture();f.ctx.ingredientSnapshot=()=>({id:'fixture:bad',edible:true,native:{version:2,id:'fixture:bad'}});f.run();assert.equal(f.state.phase,1);assert.equal(f.writes.length,0);assert.equal(f.sounds.length,0);});

test('valid cooked cache cannot hide malformed raw identity at fourth flip',()=>{const rows=rawRows();rows[0].id='not-an-item';const s=skewer(rows),cache=JSON.stringify([{id:'fixture:a'},{id:'fixture:b'},{id:'fixture:c'}]);s.props[SECRET_COOKED_INGREDIENTS_KEY]=cache;const f=fixture({stacks:[s]});f.run();assert.equal(f.state.phase,1);assert.equal(f.writes.length,0);assert.equal(f.rows[0].props[SECRET_COOKED_INGREDIENTS_KEY],cache);assert.equal(f.sounds.length,0);});


test('actual alternate secret freezes all fourth-flip slots and retains native ID and metadata through cooking',()=>{
 const original=skewer(),alternate=skewer();alternate.typeId=eatingItemId(SECRET_ID,true);alternate.amount=2;
 alternate.props.foreign=JSON.stringify({marker:'unchanged'});alternate.damage=7;alternate.keepOnDeath=true;alternate.lockMode='slot';alternate.destroy=['minecraft:stone'];alternate.place=['minecraft:dirt'];
 const f=fixture({stacks:[alternate,original,undefined]}),before=f.rows.map(s=>s?.clone());
 f.run();assert.equal(f.state.phase,2);assert.equal(f.metadataWrites,2);assert.deepEqual(f.writes,[0,1]);
 for(const index of [0,1]){
  const stored=f.rows[index],cache=stored.props[SECRET_COOKED_INGREDIENTS_KEY];assert.equal(JSON.parse(cache)[0].id,'minecraft:cooked_beef');
  const unchanged=stored.clone();delete unchanged.props[SECRET_COOKED_INGREDIENTS_KEY];assert.deepEqual(unchanged,before[index]);
  const out=f.cooked(stored);assert.equal(out.typeId,before[index].typeId);assert.equal(out.amount,1);assert.equal(out.props[SECRET_COOKED_INGREDIENTS_KEY],cache);assert.equal(out.props[SECRET_COOKED_KEY],true);
  for(const key of ['nameTag','lore','damage','keepOnDeath','lockMode','destroy','place'])assert.deepEqual(out[key],before[index][key]);
  assert.equal(out.props.foreign,before[index].props.foreign);assert.equal(out.props[SKEWER_INGREDIENTS_KEY],before[index].props[SKEWER_INGREDIENTS_KEY]);
 }
 assert.equal(f.rows[2],undefined);
});
