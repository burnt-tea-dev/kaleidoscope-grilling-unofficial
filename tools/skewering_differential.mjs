/** Executable diagnostic: unchanged production ESM + existing Minecraft API boundary.
 * Usage: node tools/skewering_differential.mjs <checkout> <report.json> [group]
 * Repro only: use group immediate-disassembly (two controlled random branches).
 * Oracle: pinned Java common/.../grilling/skewers.json and tags from data/java.
 * Does not certify native event dispatch, BDS, rendering or human acceptance.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
if(process.argv[2]==='--compare'){
 const reports=process.argv.slice(3,5).map(path=>JSON.parse(readFileSync(resolve(path),'utf8')));
 const observable=report=>report.results.map(({group,name,status,actual})=>({group,name,status,...(actual===undefined?{}:{actual})}));
 assert.deepEqual(observable(reports[0]),observable(reports[1]),'version behavior differs');
 console.log(JSON.stringify({sameObservations:true,commits:reports.map(r=>r.commit),summaries:reports.map(r=>r.summary)}));
 process.exit(0);
}
const root=resolve(process.argv[2]??'.'),reportPath=process.argv[3];
const selectedGroup=process.argv[4];
const url=pathToFileURL(root+'/');
const json=path=>JSON.parse(readFileSync(new URL(path,url),'utf8'));
const N='kaleidoscope_grilling:',IK=N+'skewer_ingredients';
const resources=json('data/java/recipes.json').resources;
const tags=json('data/java/tags.json').resources;
const recipes=resources['common/src/main/resources/data/kaleidoscope_grilling/grilling/skewers.json'].data.skewers.filter(r=>r.ingredients.length);
const {createFixture}=await import(new URL('tests/helpers/minecraft-fixture.mjs',url));
const f=createFixture();await f.load('main.js');f.startup();f.flush();
const data=await f.load('itemData.js'),snapshot=await f.load('skewer_item_snapshot.js');
const core=await f.load('a24_skewering_core.js'),ids=await f.load('eating_profile_ids.js');
const failures=await f.load('failure_skewer_visual_core.js'),grill=await f.load('core_logic.js');
const {SECRET_MODEL_VARIANTS_KEY}=await f.load('secret_visual_state_core.js');
const config=await f.load('server_config_runtime.js');
config.setGrillingConfig('enableEatingAnimations',true);
config.setGrillingConfig('graphicalEatingHud',false);
const p=f.player({name:'Diagnostic',location:{x:0,y:80,z:2}});
const results=[];
function run(group,name,body){if(selectedGroup&&selectedGroup!==group)return;try{const actual=body();results.push({group,name,status:'pass',actual});}catch(e){results.push({group,name,status:'fail',error:e.stack});}}
// Existing eating presentation may choose a random shadow route on any tick.
// Material identity comparisons normalize that route using the real export.
function raw(stack){return stack&&{id:ids.canonicalFoodId(stack.typeId),amount:stack.amount,name:stack.nameTag,lore:stack.getRawLore(),props:[...stack.dynamicProperties]};}
function inventory(){return {items:p.inventory.items().map(raw),off:raw(p.off),drops:f.drops.filter(d=>d.isValid).map(d=>raw(d.itemStack))};}
function clear(){f.faults.clear();p.inventory.clearAll();p.off=undefined;p.isSneaking=false;for(const d of f.drops)if(d.isValid)d.remove();}
function canonical(stack){return ids.canonicalFoodId(stack?.typeId);}
function rows(stack){return JSON.parse(data.getItemProperty(stack,IK)??'[]');}
function press(){const e=f.emit('world.beforeEvents.itemUse',{source:p,itemStack:p.main,cancel:false});f.flush();return e;}
function item(row,amount=4){const s=f.item(row.id,amount);s.tags=new Set(row.tags??[]);return s;}
function sourceRows(selector){
 if(!selector.startsWith('#'))return [{id:selector,tags:[]}];
 const tag=selector.slice(1),[ns,path]=tag.split(':');
 const values=tags[`common/src/main/resources/data/${ns}/tags/items/${path}.json`]?.data.values;
 assert(values?.length,'Missing pinned Java tag '+tag);
 return values.map(value=>{assert.equal(typeof value,'string');assert(!value.startsWith('#'),'Nested tag requires expansion');return {id:value,tags:[tag]};});
}
function combinations(slots){return slots.reduce((out,slot)=>out.flatMap(prefix=>slot.map(x=>[...prefix,x])),[[]]);}
function javaMatch(recipe,values){return recipe.ingredients.length===values.length&&values.every((row,i)=>recipe.ingredients[i].some(s=>s[0]==='#'?row.tags.includes(s.slice(1)):s===row.id));}
function thread(values,expected){
 clear();p.off=f.item('minecraft:stick',3);
 for(let i=0;i<values.length;i++){
  p.main=item(values[i]);assert.equal(press().cancel,true,'thread event admission');
  assert.equal(p.main?.amount,3,'one main ingredient spent');
  assert.deepEqual(rows(p.off).map(x=>x.id),values.slice(0,i+1).map(x=>x.id));
 }
 assert.equal(canonical(p.off),expected);assert.equal(p.off.amount,1);
 const sticks=p.inventory.items().filter(x=>x?.typeId==='minecraft:stick').reduce((s,x)=>s+x.amount,0);
 assert.equal(sticks,2,'unspent starter sticks returned');
 return {id:canonical(p.off),ingredients:rows(p.off).map(x=>x.id),unspentSticks:sticks};
}
for(const recipe of recipes){
 const alternatives=combinations(recipe.ingredients.map(slot=>slot.flatMap(sourceRows)));
 for(const [index,values] of alternatives.entries()){
  run('fixed',`${recipe.id} alternative ${index+1}`,()=>{
   assert.equal(core.completedRecipe(values)?.id,recipe.id);
   return thread(values,recipe.id);
  });
  const rotated=[values.at(-1),...values.slice(0,-1)];
  if(JSON.stringify(rotated.map(x=>x.id))!==JSON.stringify(values.map(x=>x.id)))run('order',`${recipe.id} rotated ${index+1}`,()=>{
   const expected=recipes.find(r=>javaMatch(r,rotated))?.id;
   assert.equal(core.completedRecipe(rotated)?.id,expected);
   // A one-slot fixed result may complete early, so this case executes the pure
   // append entry for the full ordered prefix rather than inventing a raw event.
   const out=core.appendOutcome(rotated.slice(0,-1),rotated.at(-1),true);
   assert.equal(out.id,expected??(rotated.length===3?N+'secret_skewer':N+'unfinished_skewer'));
   return {id:out.id,ingredients:out.ingredients};
  });
 }
}
const secret=[{id:'minecraft:apple'},{id:'minecraft:carrot'},{id:'minecraft:bread'}];
run('secret','three different foods via three actual item-use callbacks',()=>{
 const actual=thread(secret,N+'secret_skewer');
 assert.deepEqual(JSON.parse(data.getItemProperty(p.off,N+'secret_creator')),{name:p.name,id:p.id});
 return actual;
});
for(const count of [0,1,2])run('unfinished',`append to ${count}-ingredient unfinished stack`,()=>{
 clear();const off=f.item(N+'unfinished_skewer',3);data.setItemProperty(off,IK,JSON.stringify(secret.slice(0,count)));p.off=off;p.main=item(secret[count]);
 assert.equal(press().cancel,true);assert.equal(p.main.amount,3);
 assert.equal(canonical(p.off),count===2?N+'secret_skewer':N+'unfinished_skewer');
 assert.equal(rows(p.off).length,count+1);
 const leftovers=p.inventory.items().filter(x=>canonical(x)===N+'unfinished_skewer');
 assert.equal(leftovers.reduce((n,x)=>n+x.amount,0),2);
 return {id:canonical(p.off),ingredientCount:rows(p.off).length,unspentUnfinished:2};
});
// Metadata is produced and consumed through the actual portable item adapter.
run('metadata','thread and disassemble three differently named foods',()=>{
 clear();p.off=f.item('minecraft:stick');const before=[];
 for(const [i,row] of secret.entries()){
  const s=item(row);s.nameTag='Ingredient '+i;data.setItemLore(s,[{translate:'diagnostic.ingredient',with:[String(i)]}]);data.setItemProperty(s,'diagnostic:batch',i);
  before.push(snapshot.captureSkewerMetadata(s));p.main=s;assert.equal(press().cancel,true);
 }
 const payload=rows(p.off);assert.deepEqual(payload.map(x=>x.native),before);
 // Let the current presentation route settle for this positive roundtrip.
 // The immediate-use race is exercised independently below.
 f.flush();
 p.main=undefined;p.isSneaking=true;
 const block=f.block('minecraft:stone',{x:0,y:80,z:0});
 assert.equal(f.emit('world.beforeEvents.playerInteractWithBlock',{block,player:p,itemStack:undefined,blockFace:'Up',isFirstEvent:true,cancel:false}).cancel,true);
 f.flush();assert.equal(p.off,undefined);
 for(const expected of before){const restored=p.inventory.items().find(x=>x?.nameTag===expected.name);assert(restored);assert.deepEqual(snapshot.captureSkewerMetadata(restored),expected);assert.equal(restored.amount,1);}
 return {restored:before.map(x=>x.name)};
});
for(const random of [.25,.75])run('immediate-disassembly',`new Secret with random=${random}`,()=>{
 thread(secret,N+'secret_skewer');p.main=undefined;p.isSneaking=true;
 const block=f.block('minecraft:stone',{x:0,y:80,z:0}),oldRandom=Math.random;
 let event;
 try{
  Math.random=()=>random;
  event=f.emit('world.beforeEvents.playerInteractWithBlock',{block,player:p,itemStack:undefined,blockFace:'Up',isFirstEvent:true,cancel:false});
  assert.equal(event.cancel,true);f.flush();
 }finally{Math.random=oldRandom;}
 assert.equal(p.off?.typeId,undefined,'cancelled immediate disassembly must return the three ingredients; offhand retained after deferred action');
 return {offhandEmpty:true};
});
for(const kind of ['main-before','main-after','off-before','off-after','output-before','output-after','switched-main','switched-off','corrupt-prefix','nonfood','full-secret'])run('rejected-or-failed',kind,()=>{
 clear();p.main=f.item('minecraft:apple',4);p.off=f.item('minecraft:stick',3);
 if(kind==='nonfood')p.main=f.item('minecraft:cobblestone',4);
 if(kind==='corrupt-prefix'){
  const off=f.item(N+'unfinished_skewer');data.setItemProperty(off,IK,JSON.stringify([{id:'minecraft:carrot',native:{version:1,id:'minecraft:bread'}}]));p.off=off;
 }
 if(kind==='full-secret'){
  const off=f.item(N+'secret_skewer');data.setItemProperty(off,IK,JSON.stringify(secret));p.off=off;
 }
 if(kind.startsWith('main-'))f.faults.failNext(p.inventory,'setItem',{phase:kind.endsWith('after')?'after':'before',predicate:slot=>slot===0});
 if(kind.startsWith('off-'))f.faults.failNext(p.equipment,'setEquipment',{phase:kind.endsWith('after')?'after':'before',predicate:slot=>slot===f.EquipmentSlot.Offhand});
 if(kind.startsWith('output-'))f.faults.failNext(p.inventory,'setItem',{phase:kind.endsWith('after')?'after':'before',predicate:slot=>slot!==0});
 const before=inventory();const e=f.emit('world.beforeEvents.itemUse',{source:p,itemStack:p.main,cancel:false});
 if(kind==='switched-main')p.main=f.item('minecraft:carrot',7);
 if(kind==='switched-off')p.off=f.item('minecraft:stick',8);
 const expected=kind.startsWith('switched-')?inventory():before;
 f.flush();assert.deepEqual(inventory(),expected,'failed/rejected action must keep actual held materials');
 assert.equal(f.faults.pending.length,0,'injected write boundary must execute');
 return {cancel:e.cancel,mainId:canonical(p.main),mainAmount:p.main?.amount,offId:canonical(p.off),offAmount:p.off?.amount};
});
for(const result of [N+'dark_grilling',N+'mysterious_skewer'])for(const source of [...recipes.filter(r=>r.cooked_result).map(r=>r.id),N+'secret_skewer'])run('failure-metadata',`${source} -> ${result}`,()=>{
 clear();const input=f.item(source,5);input.nameTag='Retained source';data.setItemLore(input,[{translate:'diagnostic.failure',with:['retained']}]);
 data.setItemProperty(input,'diagnostic:source','kept');data.setItemProperty(input,IK,JSON.stringify(secret));
 data.setItemProperty(input,SECRET_MODEL_VARIANTS_KEY,'[4,8,9]');
 if(source===N+'secret_skewer')data.setItemProperty(input,N+'secret_creator','{"name":"Diagnostic","id":"synthetic"}');
 const before=snapshot.captureSkewerMetadata(input);
 const output=failures.createFailedSkewer(input,result,(id,n)=>f.item(id,n),id=>new f.server.EnchantmentType(id));
 const expected={...before,id:result,props:{...before.props,[failures.FAILED_SOURCE_KEY]:source===N+'secret_skewer'?'custom':source}};
 assert.deepEqual(snapshot.captureSkewerMetadata(output),expected);assert.equal(output.amount,1);assert.deepEqual(snapshot.captureSkewerMetadata(input),before);assert.equal(input.amount,5);
 return {id:output.typeId,source:data.getItemProperty(output,failures.FAILED_SOURCE_KEY),metadataRetained:true};
});
run('failure-source','real grill state chooses dark on timeout and mysterious on early break',()=>{
 const brushed=grill.brush(grill.light(grill.initialState(),true),1,1200).state;
 assert.equal(grill.breakDisposition(brushed),'mysterious');
 const timed=grill.tickState(brushed,1,grill.FINISHED_TICKS).state;
 assert.equal(grill.outputKind(timed),'dark');assert.equal(grill.breakDisposition(timed),'dark');
 return {earlyBreak:'mysterious',timeoutExtract:'dark',timeoutBreak:'dark'};
});
const stateAdapter=await f.load('a2740_grill_state_adapter.js'),storage=await f.load('family_station_storage.js');
let stationNumber=0;
for(const source of [N+'raw_beef_skewer',N+'secret_skewer'])for(const action of ['dark-extract','dark-break','mysterious-break'])run('failure-station',`${source} ${action}`,()=>{
 clear();const block=f.block(N+'grill',{x:10+(stationNumber++)*3,y:80,z:0});
 f.block('minecraft:stone',{x:block.x,y:79,z:0});
 const container=storage.stationContainer(block),input=f.item(source);input.nameTag='Station input';
 data.setItemProperty(input,IK,JSON.stringify(secret));data.setItemProperty(input,'diagnostic:origin','station');
 const before=snapshot.captureSkewerMetadata(input);container.setItem(0,input);
 const state={...grill.initialState(),lit:true,phase:action.startsWith('dark')?3:1,heatTicks:1200};
 f.world.setDynamicProperty(stateAdapter.grillStateKey(block),JSON.stringify(state));
 if(action.endsWith('break'))assert.equal(f.emit('world.beforeEvents.playerBreakBlock',{block,player:p,cancel:false}).cancel,true);
 else assert.equal(f.emit('world.beforeEvents.playerInteractWithBlock',{block,player:p,itemStack:undefined,blockFace:'Up',isFirstEvent:true,cancel:false}).cancel,true);
 f.flush();
 const expectedId=N+(action.startsWith('dark')?'dark_grilling':'mysterious_skewer');
 const output=[...p.inventory.items(),...f.drops.filter(d=>d.isValid).map(d=>d.itemStack)].find(s=>canonical(s)===expectedId);
 assert(output,'failure output delivered');
 const expected={...before,id:output.typeId,props:{...before.props,[failures.FAILED_SOURCE_KEY]:source===N+'secret_skewer'?'custom':source}};
 assert.deepEqual(snapshot.captureSkewerMetadata(output),expected);assert.equal(output.amount,1);
 assert.equal(container.getItem(0),undefined);
 return {id:canonical(output),source:data.getItemProperty(output,failures.FAILED_SOURCE_KEY),metadataRetained:true};
});
f.dispose();
const report={schema:1,commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,scope:'unchanged production imports and actual subscribed callbacks; Minecraft API doubles only; client=false; production_ready=false',summary:{total:results.length,passed:results.filter(x=>x.status==='pass').length,failed:results.filter(x=>x.status==='fail').length},results};
if(reportPath)writeFileSync(resolve(reportPath),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({commit:report.commit,...report.summary}));
for(const r of results.filter(x=>x.status==='fail'))console.error(r.group,r.name,r.error);
process.exitCode=report.summary.failed?1:0;
