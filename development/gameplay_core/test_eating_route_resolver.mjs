/** Differential execution of the unchanged subscriber projection boundary. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import * as generic from '../../projects/grilling/gameplay_core/behavior_pack/scripts/java_eating_projection_items.js';
import * as failure from '../../projects/grilling/gameplay_core/behavior_pack/scripts/failure_skewer_projection.js';
import * as raw from '../../projects/grilling/gameplay_core/behavior_pack/scripts/raw_one_projection.js';
import * as reviewed from '../../projects/grilling/gameplay_core/behavior_pack/scripts/review_three_projection.js';
import {eatingNativeTicks} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/player_presentation_core.js';
import {PROFILE_BY_ITEM} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_data_lookup.js';
const root=new URL('../../',import.meta.url), base='2e05439ced5e20810547d3e239c1c7036a5a65fc';
const main='projects/grilling/gameplay_core/behavior_pack/scripts/main.js';
const before=execFileSync('git',['show',base+':'+main],{cwd:root,encoding:'utf8'});
const after=fs.readFileSync(new URL(main,root),'utf8');
const moduleText=fs.readFileSync(new URL('projects/grilling/gameplay_core/behavior_pack/scripts/eating_projection_routes.js',root),'utf8').replace(/^import .*;\n/gm,'').replace(/export function/g,'function');
function boundary(s){return s.slice(s.indexOf(' if(eatingNativeTicks(a.nativeDuration)>0&&'),s.indexOf(' // Native use_item_progress can remain zero'));}
function run(s,{id,profile,hand,occupied,duration=90,failAt=0},modern,resolverText=moduleText){
 const trace=[];let calls=0;
 function step(name,value){trace.push([name,value]);if(++calls===failAt)throw Error('injected '+name);return value;}
 const item={get typeId(){return step('typeId',id)}};
 const player={get setProperty(){step('get:setProperty');return (k,v)=>step('setProperty',[k,v])},get playAnimation(){step('get:playAnimation');return (id,options)=>step('playAnimation',[id,options])}};
 const e={get itemStack(){step('itemStack');return item},get source(){step('source');return player}};
 const ctx={e,profile,hand,a:{nativeDuration:duration},EAT_PROJECTION_PROPERTY:'projection',eatingNativeTicks,
 heldByHand:(p,h)=>step('heldByHand',h)&& (occupied?{}:undefined),console:{warn:s=>trace.push(['warn',s])}};
 for(const [name,fn]of Object.entries({...generic,...failure,...raw,...reviewed}))if(typeof fn==='function')ctx[name]=(...args)=>{step(name,args);return fn(...args)};
 vm.createContext(ctx);if(modern)vm.runInContext(resolverText,ctx);
 try{vm.runInContext(boundary(s),ctx)}catch(error){trace.push(['throw',error.message])}
 return JSON.parse(JSON.stringify(trace));
}
const baselineRows=JSON.parse(fs.readFileSync(new URL('development/gameplay_core/fixtures/eating-route-baseline-dispatch.json',root),'utf8'));
const ids=[...new Set([...baselineRows.map(r=>r.id),...Object.keys(PROFILE_BY_ITEM)]),'minecraft:apple',undefined,null];
test('exact routing/property/getter/helper trace over expanded ID/profile/hand/occupancy/duration matrix',()=>{
 let count=0;
 for(const id of ids)for(const profile of ['ONE','TWO','THREE','THREE_ALT','FOUR','INVALID'])for(const hand of ['main','off','invalid'])for(const occupied of [false,true])for(const duration of [0,90]){
  const c={id,profile,hand,occupied,duration};assert.deepEqual(run(after,c,true),run(before,c,false),JSON.stringify(c));count++;
 }
 console.log('Differential cases:',count);
});
test('every observable getter/helper/property failure point retains order and catch behavior',()=>{
 let count=0;
 for(const id of ids)for(const profile of ['ONE','TWO','THREE','THREE_ALT'])for(const hand of ['main','off']){
  const c={id,profile,hand,occupied:false};const n=run(before,c,false).length;
  for(let failAt=1;failAt<=n;failAt++){assert.deepEqual(run(after,{...c,failAt},true),run(before,{...c,failAt},false),JSON.stringify({...c,failAt}));count++;}
 }
 console.log('Injected failure cases:',count);
});

test('actual subscriber before/after preserves 212 baseline routes and occupied/invalid-duration lifecycle',()=>{
 const harness=fs.readFileSync(new URL('development/gameplay_core/test_eating_native_completion.mjs',root),'utf8').split("test('inclusive native boundary")[0];
 const historicalHarness=execFileSync('git',['show',base+':development/gameplay_core/test_eating_native_completion.mjs'],{cwd:root,encoding:'utf8'}).split("test('inclusive native boundary")[0];
 const append=`const rows=${JSON.stringify(baselineRows)}; const out=[];
 const validSecretRows=['minecraft:apple','minecraft:carrot','minecraft:beef'].map(id=>({id}));
 for(const row of rows)for(const helperEmpty of [true,false])for(const duration of [0,row.duration]){
 const f=fixture({mealId:row.id,hand:row.hand,profile:row.profile,duration,helperEmpty,ingredientRows:canonicalFoodId(row.id)==='kaleidoscope_grilling:secret_skewer'?validSecretRows:undefined});
 f.startUse();if(helperEmpty && duration>0)assert.deepEqual(JSON.parse(JSON.stringify(f.animations.map(([name,options])=>({name,options})))),row.animations);const started={animations:f.animations,properties:[...f.properties],counts:{...f.counts}};
 f.stop({tick:101});f.flush();out.push({id:row.id,hand:row.hand,helperEmpty,duration,started,ended:{properties:[...f.properties],counts:f.counts,active:f.ctx.ACTIVE_EATS.size}});
 }console.log(JSON.stringify(out));`;
 function execute(source,selectedHarness){
  const code=selectedHarness.replace(/const source=fs.readFileSync\([^\n]+/, 'const source='+JSON.stringify(source)+';')+append;
  return JSON.parse(execFileSync('node',['--input-type=module'],{cwd:new URL('development/gameplay_core/',root),encoding:'utf8',input:code,maxBuffer:16e6}));
 }
 assert.deepEqual(execute(after,harness),execute(before,historicalHarness));
 console.log('Actual subscriber lifecycle cases:',baselineRows.length*4);
});

test('actual subscriber rejects invalid secret metadata while valid secret routes retain baseline coverage',()=>{
 const harness=fs.readFileSync(new URL('development/gameplay_core/test_eating_native_completion.mjs',root),'utf8').split("test('inclusive native boundary")[0];
 const append=`const valid=['minecraft:apple','minecraft:carrot','minecraft:beef'].map(id=>({id}));let rejected=0;
 for(const mealId of ['kaleidoscope_grilling:secret_skewer','kaleidoscope_grilling:secret_skewer_java_three_alt','kaleidoscope_grilling:secret_skewer_native_plain'])for(const hand of ['main','off']){
 const good=fixture({mealId,hand,duration:100,helperEmpty:true,ingredientRows:valid});assert.ok(good.startUse());assert.equal(good.ctx.ACTIVE_EATS.size,1);
 for(const ingredientRows of [undefined,[],valid.slice(0,2),[{id:'fixture:missing'},...valid.slice(1)],[{id:'minecraft:air'},...valid.slice(1)],[{id:'minecraft:apple',nutrition:null},...valid.slice(1)]]){
 const f=fixture({mealId,hand,duration:100,helperEmpty:true,ingredientRows});const original=JSON.stringify(f.state.stack);
 assert.equal(f.startUse(),undefined);assert.equal(f.animations.length,0);assert.equal(f.ctx.ACTIVE_EATS.size,0);
 f.complete({tick:199});f.stop({tick:199});f.flush();assert.equal(f.counts.nativeRewards+f.counts.manualRewards,0);assert.equal(f.counts.manualWrites,0);assert.equal(JSON.stringify(f.state.stack),original);rejected++;
 }}console.log('Rejected secret subscriber cases:',rejected);`;
 const output=execFileSync('node',['--input-type=module'],{cwd:new URL('development/gameplay_core/',root),encoding:'utf8',input:harness+append,maxBuffer:16e6});
 assert.match(output,/Rejected secret subscriber cases: 36/);
});

test('route ownership, precedence, lazy occupancy, and stop mutations are detected',()=>{
 const cases=[
  ["hand === 'off'", "hand === 'main'", {id:'kaleidoscope_grilling:grilled_lamb_skewer',profile:'THREE',hand:'off'}],
  ["animation.kg_offhand_projection.player.", "animation.kg_java_eating.player.", {id:'kaleidoscope_grilling:grilled_lamb_skewer',profile:'THREE',hand:'off'}],
  ["failureEatingAnimation(e.itemStack.typeId,p,h)", "null", {id:'kaleidoscope_grilling:dark_grilling',profile:'THREE',hand:'main'}],
  ["rawOneAnimation(e.itemStack.typeId,p,h)", "null", {id:'kaleidoscope_grilling:raw_fish_skewer',profile:'ONE',hand:'main'}],
  ["reviewedThreeAnimation(e.itemStack.typeId,p,h)", "null", {id:'kaleidoscope_grilling:grilled_lamb_skewer',profile:'THREE',hand:'main'}],
  ["!held(e.source,'off')", "true", {id:'kaleidoscope_grilling:grilled_bun_slice_skewer',profile:'TWO',hand:'main',occupied:true}],
  ["!heldByHand(e.source,hand === 'off' ? 'main' : 'off')", "true", {id:'kaleidoscope_grilling:raw_fish_skewer',profile:'ONE',hand:'off',occupied:true}],
  ["ORDINARY_ALT.includes(e.itemStack.typeId)", "true", {id:'kaleidoscope_grilling:secret_skewer_java_three_alt',profile:'THREE_ALT',hand:'main'}],
 ];
 for(const [from,to,c] of cases){assert.ok(moduleText.includes(from));assert.notDeepEqual(run(after,c,true,moduleText.replace(from,to)),run(before,c,false),from);}
 const c={id:'kaleidoscope_grilling:secret_skewer',profile:'THREE',hand:'main'};
 assert.notDeepEqual(run(after.replace("controller:'kg_java_eating_first_person'","controller:'wrong'"),c,true),run(before,c,false));
 assert.notDeepEqual(run(after.replace(boundary(after),boundary(after).replace('!q.is_using_item || !q.is_item_name_any','q.is_using_item || !q.is_item_name_any')),c,true),run(before,c,false));
});
