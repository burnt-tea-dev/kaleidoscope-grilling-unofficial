/** Actual clean/patched author modules and actual G recipes; SDK-shaped doubles only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {recipeTable} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2727_cookery_host_recipes_core.js';
import {admitPublicMillstoneInput} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/host_api/millstone_api_core.js';

const fixture=process.env.COOKERY_MILLSTONE_FIXTURE;
assert(fixture,'COOKERY_MILLSTONE_FIXTURE must name the checksum-verified Git-external actual author fixture');
const strip=s=>s.replace(/^import\s[^;]+;\s*/gm,'').replace(/^export /gm,'');
const load=name=>fs.readFileSync(path.join(fixture,name),'utf8');
const powders=recipeTable().map(r=>r.payload).filter(r=>r.kind==='millstone');
assert.equal(powders.length,7,'Exercise the actual seven declared powder recipes');
function data(name,fields){const c=vm.createContext({});vm.runInContext(strip(load(name))+'\nglobalThis.values={'+fields+'};',c);return c.values;}
const builtins={...data('stationRecipes.js','POT_RECIPES'),...data('stockpotJavaRecipes.js','STOCKPOT_EXACT_JAVA,STOCKPOT_FLEX_JAVA')};
class Item{constructor(typeId,amount=1){this.typeId=typeId;this.amount=amount;}clone(){return new Item(this.typeId,this.amount);}}
function setup({clean=false,input=powders[0].recipe.input,count=2}={}){
 const properties=new Map(),drops=[],out=[];
 const system={currentTick:4,run(){},runTimeout(){return 1;},runInterval(){return 1;},clearRun(){},sendScriptEvent(){},afterEvents:{scriptEventReceive:{subscribe(){}}}};
 const registry=vm.createContext({...builtins,system,console,BOARD_CAPABILITIES:[],OIL_CAPABILITIES:[],CUISINE_CAPABILITIES:[],GUIDE_CAPABILITIES:[],INGREDIENT_CAPABILITIES:[],JAVA_POT_CAPABILITIES:[],registerBoardV2Recipe(){return {ok:true};}});
 vm.runInContext(strip(load('extensionRegistry.js'))+'\nglobalThis.api={registerExtensionRecipe,getExtensionMillstoneRecipe};',registry);
 for(const row of powders)assert.equal(registry.api.registerExtensionRecipe(row).ok,true);
 const world={getDynamicProperty:k=>properties.get(k),setDynamicProperty(k,v){if(v===undefined)properties.delete(k);else properties.set(k,v);},afterEvents:Object.fromEntries(['entityLoad','entityHurt','blockExplode'].map(k=>[k,{subscribe(){}}]))};
 const dimension={id:'minecraft:overworld',getBlock:()=>block,getEntities:q=>q.type==='minecraft:item'?drops:[],spawnItem(item,at){out.push({item:item.clone(),at});}};
 const block={typeId:'kaleidoscope_cookery:millstone',x:0,y:64,z:0,location:{x:0,y:64,z:0},dimension,
  permutation:{getState:k=>k==='kaleidoscope_cookery:millstone_part'?'center':k==='minecraft:cardinal_direction'?'north':undefined}};
 let hand=new Item(input,count);
 const slot={hasItem:()=>!!hand,getItem:()=>hand?.clone(),setItem(s){hand=s?.clone();}};
 const player={isSneaking:false,getComponent:()=>({getEquipmentSlot:()=>slot}),getGameMode:()=> 'Survival'};
 const ctx=vm.createContext({world,system,ItemStack:Item,EquipmentSlot:{Mainhand:'Mainhand'},GameMode:{Creative:'Creative'},
  getExtensionMillstoneRecipe:registry.api.getExtensionMillstoneRecipe,admitPublicMillstoneInput,console,hint(){return '';},detailedFeedbackEnabled:()=>false,playSoundAccessible(){}});
 vm.runInContext(strip(load(clean?'millstone.clean.js':'millstone.js'))+'\nglobalThis.api={millstoneComponent,absorbWorkerInventory,absorbDropped,getProcess,process,machineSpeed};',ctx);
 return {api:ctx.api,block,player,registry:registry.api,slot,drops,out,properties,
  worker(){const items=[new Item(input,count)];const container={size:1,getItem:i=>items[i]?.clone(),setItem(i,s){items[i]=s?.clone();}};return {entity:{getComponent:()=>({container})},items};},
  drop(){const e={location:{x:.5,y:65.25,z:.5},getComponent:()=>({itemStack:new Item(input,count)}),remove(){drops.splice(drops.indexOf(e),1);}};drops.push(e);},
 };
}
function admit(f,route){
 if(route==='hand'){f.api.millstoneComponent.onPlayerInteract({block:f.block,player:f.player});return f.slot.getItem()?.amount??0;}
 if(route==='worker'){const w=f.worker();f.api.absorbWorkerInventory(f.block,w.entity);return w.items[0]?.amount??0;}
 f.drop();f.api.absorbDropped(f.block);return f.drops.length?2:0;
}

test('clean current author accepts all seven recipe registrations but rejects each normal input gate',()=>{
 for(const row of powders)for(const route of ['hand','worker','drop']){
  const f=setup({clean:true,input:row.recipe.input});assert(f.registry.getExtensionMillstoneRecipe(row.recipe.input));
  assert.equal(admit(f,route),2,route+' retains rejected input');assert.equal(f.api.getProcess(f.block),null);
 }
});

test('public adapter makes all seven registered powders usable through all three actual author gates',()=>{
 for(const row of powders)for(const route of ['hand','worker','drop']){
  const f=setup({input:row.recipe.input});assert.equal(admit(f,route),0,route+' debits exactly the admitted input');
  const state=f.api.getProcess(f.block);assert.equal(state.input,row.recipe.input);assert.equal(state.count,2);
  assert.equal(state.total,100,'author162 owns the unmodified processing duration');assert.equal(state.progress,100);
  for(let tick=0;tick<100;tick++)f.api.process(f.block,{});
  const actual=f.api.getProcess(f.block);assert.equal(actual.count,0);
  assert.deepEqual(JSON.parse(JSON.stringify(actual.outputs)),row.recipe.outputs.map(o=>({id:o.id,count:2*o.count})));
 }
});

test('builtin admission, unknown rejection and the author eight-input capacity remain intact',()=>{
 for(const route of ['hand','worker','drop']){
  const builtin=setup({input:'minecraft:wheat_seeds'});assert.equal(admit(builtin,route),0);assert.equal(builtin.api.getProcess(builtin.block).input,'minecraft:wheat_seeds');
  const unknown=setup({input:'external:not_registered'});assert.equal(admit(unknown,route),2);assert.equal(unknown.api.getProcess(unknown.block),null);
 }
 const f=setup({count:12});f.api.millstoneComponent.onPlayerInteract({block:f.block,player:f.player});
 assert.equal(f.api.getProcess(f.block).count,8);assert.equal(f.slot.getItem().amount,4);
 f.api.millstoneComponent.onPlayerInteract({block:f.block,player:f.player});
 assert.equal(f.api.getProcess(f.block).count,8);assert.equal(f.slot.getItem().amount,4);
});
