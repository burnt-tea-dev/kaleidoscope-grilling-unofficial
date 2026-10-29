/** Executable diagnostic: unchanged production ESM + existing Minecraft API boundary.
 * Usage: node tools/skewering_differential.mjs <checkout> <report.json> [group] [exact case name]
 * Repro only: use group immediate-disassembly (two controlled random branches).
 * Oracle: pinned Java common/.../grilling/skewers.json and tags from data/java.
 * Does not certify native event dispatch, BDS, rendering or human acceptance.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,unlinkSync,rmdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';

// Error stacks are diagnostics, never comparison evidence. Schema 2 fails
// closed on legacy text-only errors and errors we cannot classify safely.
function stableValue(value){
 if(value===undefined)return {$type:'undefined'};
 if(value===null||typeof value==='string'||typeof value==='boolean')return value;
 if(typeof value==='number')return Number.isFinite(value)?value:{$type:String(value)};
 if(Array.isArray(value))return value.map(stableValue);
 if(value&&Object.getPrototypeOf(value)===Object.prototype)return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stableValue(value[k])]));
 throw Error('Unsupported assertion value; failure cannot be compared safely');
}
function classifiedFailure(error){
 if(error?.code==='ERR_ASSERTION'&&typeof error.operator==='string'){
  try{return {classification:'assertion-mismatch',name:error.name,code:error.code,operator:error.operator,actual:stableValue(error.actual),expected:stableValue(error.expected)};}catch{}
 }
 return {classification:'unclassified-error',name:String(error?.name??'Error'),code:String(error?.code??'')};
}
function layerSummary(results){return Object.fromEntries(['pure-module','runtime-callback'].map(layer=>{
 const rows=results.filter(row=>row.layer===layer);
 return [layer,{total:rows.length,passed:rows.filter(row=>row.status==='pass').length,failed:rows.filter(row=>row.status==='fail').length}];
}));}
function observable(report){
 assert.equal(report.schema,2,'comparison requires structured schema 2 reports');
 assert(Array.isArray(report.results)&&report.results.length>0,'empty reports are not evidence');
 const counts={total:report.results.length,passed:0,failed:0},keys=new Set();
 const results=report.results.map(row=>{
  assert.equal(typeof row.group,'string');assert.equal(typeof row.name,'string');
  const key=JSON.stringify([row.group,row.name]);assert(!keys.has(key),'duplicate case');keys.add(key);
  assert(['pure-module','runtime-callback'].includes(row.layer),'unknown execution layer');
  assert(['pass','fail'].includes(row.status),'unknown result status');
  counts[row.status==='pass'?'passed':'failed']++;
  if(row.status==='fail'){
   assert(row.error&&typeof row.error==='object'&&!Array.isArray(row.error),'text-only failure is not comparable');
   assert.equal(row.error.classification,'assertion-mismatch','unclassified failures cannot prove equivalence');
   assert.equal(row.error.code,'ERR_ASSERTION');assert.equal(typeof row.error.name,'string');assert.equal(typeof row.error.operator,'string');
   assert(Object.hasOwn(row.error,'actual')&&Object.hasOwn(row.error,'expected'),'missing assertion operands');
   assert(row.actual?.complete===true&&row.actual?.player&&typeof row.actual.phase==='string','missing or unreadable failure state');
   return {group:row.group,name:row.name,layer:row.layer,status:row.status,error:row.error,actual:row.actual};
  }
  return {group:row.group,name:row.name,layer:row.layer,status:row.status,...(row.actual===undefined?{}:{actual:row.actual})};
 });
 assert.deepEqual(report.summary,counts,'report summary disagrees with cases');
 assert.deepEqual(report.layers,layerSummary(report.results),'execution layer counts disagree with cases');
 return results;
}
if(process.argv[2]==='--compare'){
 const reports=process.argv.slice(3,5).map(path=>JSON.parse(readFileSync(resolve(path),'utf8')));
 assert.equal(reports.length,2,'provide exactly two report paths');
 assert.deepEqual(observable(reports[0]),observable(reports[1]),'version behavior differs');
 console.log(JSON.stringify({sameObservations:true,commits:reports.map(r=>r.commit),summaries:reports.map(r=>r.summary)}));
 process.exit(0);
}
if(process.argv[2]==='--self-test'){
 const dir=mkdtempSync(join(resolve(process.argv[3]??tmpdir()),'skewering-compare-'));
 const left=join(dir,'left.json'),right=join(dir,'right.json'),controls=[];
 const base={schema:2,scope:'synthetic comparator control; not a runtime observation',commit:'synthetic',summary:{total:1,passed:0,failed:1},results:[{
  group:'synthetic-control',name:'different failures must differ',layer:'runtime-callback',status:'fail',
  error:{classification:'assertion-mismatch',name:'AssertionError',code:'ERR_ASSERTION',operator:'strictEqual',actual:'secret_skewer_java_three_alt',expected:{$type:'undefined'}},
  actual:{complete:true,phase:'deferred-action-finished',player:{main:null,off:{nativeId:'secret_skewer_java_three_alt',amount:1},inventory:[],drops:[]}},diagnosticStack:'Error at /machine-A/test.mjs:1:1'
 }]};
 base.layers=layerSummary(base.results);
 function control(name,expectedExit,mutate){
  const changed=structuredClone(base);mutate(changed);
  writeFileSync(left,JSON.stringify(base));writeFileSync(right,JSON.stringify(changed));
  const child=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--compare',left,right],{encoding:'utf8'});
  assert.ifError(child.error);assert.notEqual(child.status,null,'comparison process must exit');
  assert.equal(child.status===0,expectedExit===0,name+'\n'+child.stderr);
  controls.push({name,expected:expectedExit===0?'equal':'reject',exit:child.status,status:'pass'});
 }
 try{
  control('identical structured observations',0,()=>{});
  control('different diagnostic paths and stacks remain equal',0,r=>{r.results[0].diagnosticStack='Error at C:\\machine-B\\other.mjs:999:5';});
  control('reviewer text-only lost-items mutation is rejected',1,r=>{r.results[0].error='offhand unexpectedly lost all items';});
  control('structured actual offhand loss is rejected',1,r=>{r.results[0].actual.player.off=null;});
  control('different assertion actual is rejected',1,r=>{r.results[0].error.actual='all items lost';});
  control('different assertion expected is rejected',1,r=>{r.results[0].error.expected=null;});
  control('unclassified error is rejected',1,r=>{r.results[0].error.classification='unclassified-error';});
  control('missing actual state is rejected',1,r=>{delete r.results[0].actual;});
  control('legacy text-only schema is rejected',1,r=>{r.schema=1;});
 }finally{for(const file of [left,right])try{unlinkSync(file)}catch{}rmdirSync(dir);}
 const report={scope:'synthetic comparator controls only; not runtime evidence',passed:controls.length,failed:0,controls};
 if(process.argv[4])writeFileSync(resolve(process.argv[4]),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));process.exit(0);
}
const root=resolve(process.argv[2]??'.'),reportPath=process.argv[3];
const selectedGroup=process.argv[4];
const selectedCase=process.argv[5];
const url=pathToFileURL(root+'/');
const json=path=>JSON.parse(readFileSync(new URL(path,url),'utf8'));
const N='kaleidoscope_grilling:',IK=N+'skewer_ingredients';
const resources=json('data/java/recipes.json').resources;
const tags=json('data/java/tags.json').resources;
const recipes=resources['common/src/main/resources/data/kaleidoscope_grilling/grilling/skewers.json'].data.skewers.filter(r=>r.ingredients.length);
const {createFixture}=await import(new URL('tests/helpers/minecraft-fixture.mjs',url));
const f=createFixture();await f.load('main.js');f.startup();f.flush();
const data=await f.load('core/persist.js'),snapshot=await f.load('skewer_item_snapshot.js');
const core=await f.load('skewer/skewering_core.js'),ids=await f.load('eating_profile_ids.js');
const failures=await f.load('failure_skewer_visual_core.js'),grill=await f.load('core_logic.js');
const {SECRET_MODEL_VARIANTS_KEY}=await f.load('secret_visual_state_core.js');
const config=await f.load('server_config_runtime.js');
config.setGrillingConfig('enableEatingAnimations',true);
config.setGrillingConfig('graphicalEatingHud',false);
const p=f.player({name:'Diagnostic',location:{x:0,y:80,z:2}});
const results=[];
let observation;
function observe(phase,details={}){observation={phase,...details};}
function observedStack(stack){
 if(!stack)return null;
 const ingredients=data.getItemProperty(stack,IK);
 return {nativeId:stack.typeId,canonicalId:canonical(stack),amount:stack.amount,
  ingredients:ingredients===undefined?null:JSON.parse(ingredients).map(row=>row.id)};
}
function failureState(){
 try{return {...observation,complete:true,player:{main:observedStack(p.main),off:observedStack(p.off),
  inventory:p.inventory.items().map(observedStack),drops:f.drops.filter(d=>d.isValid).map(d=>observedStack(d.itemStack))}};}
 catch{return {...observation,complete:false};}
}
function run(group,name,body){
 if((selectedGroup&&selectedGroup!==group)||(selectedCase&&selectedCase!==name))return;
 const layer=['order','failure-metadata','failure-source'].includes(group)?'pure-module':'runtime-callback';
 observe('case-entry');
 try{const actual=body();results.push({group,name,layer,status:'pass',actual});}
 catch(e){results.push({group,name,layer,status:'fail',error:classifiedFailure(e),actual:failureState(),diagnosticStack:e.stack});}
}
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
 const before=inventory(),input=snapshot.captureSkewerMetadata(p.off);
 const beforeCounts=materialCounts();
 const block=f.block('minecraft:stone',{x:0,y:80,z:0}),oldRandom=Math.random;
 let event;
 try{
  Math.random=()=>random;
  event=f.emit('world.beforeEvents.playerInteractWithBlock',{block,player:p,itemStack:undefined,blockFace:'Up',isFirstEvent:true,cancel:false});
  observe('interaction-admitted',{random,eventCancelled:event.cancel});
  assert.equal(event.cancel,true);f.flush();
  observe('deferred-action-finished',{random,eventCancelled:event.cancel});
 }finally{Math.random=oldRandom;}
 const afterCounts=materialCounts(),refunds=Object.fromEntries([...new Set([...Object.keys(beforeCounts),...Object.keys(afterCounts)])].sort().map(id=>[id,(afterCounts[id]??0)-(beforeCounts[id]??0)]).filter(([,amount])=>amount!==0));
 const expectedRefunds={'minecraft:apple':1,'minecraft:bread':1,'minecraft:carrot':1,'minecraft:stick':1};
 observe('deferred-action-finished',{random,eventCancelled:event.cancel,refunds,expectedRefunds});
 if(p.off){
  const after=inventory(),retained=snapshot.captureSkewerMetadata(p.off);
  assert.deepEqual(after.items,before.items,'cancelled disassembly must not change inventory');
  assert.deepEqual(after.drops,before.drops,'cancelled disassembly must not change drops');
  assert.equal(p.off.amount,before.off.amount);
  assert.deepEqual({...retained,id:ids.canonicalFoodId(retained.id)},{...input,id:ids.canonicalFoodId(input.id)},'cancelled disassembly must retain ingredient lore and properties');
  observe('deferred-action-finished',{random,eventCancelled:event.cancel,refunds,expectedRefunds,retainedInputUnchanged:true});
 }
 assert.equal(p.off?.typeId,undefined,'cancelled immediate disassembly must return the three ingredients; offhand retained after deferred action');
 assert.deepEqual(refunds,expectedRefunds,'successful disassembly must return one of every ingredient and one stick');
 return {offhandEmpty:true,refunds};
});
function materialCounts(){
 const counts={};
 for(const stack of [...p.inventory.items(),...f.drops.filter(d=>d.isValid).map(d=>d.itemStack)])if(stack){const id=canonical(stack);counts[id]=(counts[id]??0)+stack.amount;}
 return counts;
}
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
const stateAdapter=await f.load('grill/grill_state_adapter.js'),storage=await f.load('core/storage.js');
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
const report={schema:2,commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,scope:'55 pure-module cases and 50 runtime-callback cases in the full matrix; unchanged production imports; Minecraft API doubles only, not native end-to-end; failure state compares native/canonical IDs, counts and ingredient IDs; full metadata assertions retain their own operands; client=false; production_ready=false',summary:{total:results.length,passed:results.filter(x=>x.status==='pass').length,failed:results.filter(x=>x.status==='fail').length},layers:layerSummary(results),results};
if(reportPath)writeFileSync(resolve(reportPath),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({commit:report.commit,...report.summary,layers:report.layers}));
for(const r of results.filter(x=>x.status==='fail'))console.error(r.group,r.name,JSON.stringify({error:r.error,actual:r.actual}),r.diagnosticStack);
process.exitCode=report.summary.failed?1:0;
