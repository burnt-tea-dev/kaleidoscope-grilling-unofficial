import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {updateNumbVisual,forgetNumbVisual,suppressNumbVisual} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/numb_visual_runtime.js';
const animations=JSON.parse(fs.readFileSync(new URL('../../projects/grilling/gameplay_core/resource_pack/animations/a22_numb.animation.json',import.meta.url),'utf8')).animations;
test('Numb clips omit optional bones rather than declaring an empty bone map',()=>{
 for(const [name,clip] of Object.entries(animations)){
  if(!Object.hasOwn(clip,'bones'))continue;
  assert.ok(clip.bones&&typeof clip.bones==='object'&&!Array.isArray(clip.bones),name);
  const names=Object.keys(clip.bones);
  assert.ok(names.length>0,`${name}: a present bones map requires a named child`);
  assert.ok(names.every(bone=>/^[a-zA-Z0-9_.-]+$/.test(bone)),name);
 }
});
test('Numb completes the Java age-tick cycle in under one second, not twenty seconds',()=>{
 const clip=animations['animation.kg_a22.player.numb'];
 const rotation=Function('q','math','return '+clip.bones.rightarm.rotation[0]);
 const math={cos:degrees=>Math.cos(degrees*Math.PI/180),min:Math.min};
 // Java 1.1.1 HumanoidAnvilPressMixin: quarter-cycle age = 4.90873852 ticks.
 // These are wall-clock samples; Molang trig is degrees and life_time seconds.
 for(const [seconds,expected] of [[0,177.62],[.245436926,0],[.490873852,-177.62],[.736310778,0],[.981747704,177.62]])
  assert.ok(Math.abs(rotation({life_time:seconds,modified_move_speed:1},math)-expected)<.001,`wrong pose at ${seconds}s`);
 assert.equal(clip.loop,true);
 assert.ok(!Object.hasOwn(clip,'anim_time_update'));
});
test('resync and release own one Numb controller without fading or resetting another pose',()=>{
 const calls=[],player={id:'numb-regression',playAnimation:(animation,options)=>calls.push({animation,options})};
 for(let tick=0;tick<=36;tick++)updateNumbVisual(player,true,tick);
 assert.equal(calls.length,4,'bounded observer resync, not one restart per tick');
 for(const {animation,options} of calls){assert.equal(animation,'animation.kg_a22.player.numb');assert.equal(options.controller,'kg_numb');assert.equal(options.blendOutTime,0);assert.equal(options.stopExpression,'0')}
 updateNumbVisual(player,false,37);updateNumbVisual(player,false,38);
 assert.equal(calls.length,5);assert.equal(calls[4].animation,'animation.kg_a22.player.numb_stop');assert.equal(calls[4].options.controller,'kg_numb');
 assert.deepEqual(animations[calls[4].animation],{animation_length:0.05});
 updateNumbVisual(player,true,39);assert.equal(calls.length,6);
 forgetNumbVisual(player.id);
});
test('an active pose immediately suppresses only its player through the full motion deadline',()=>{
 const calls=[],otherCalls=[];
 const player=Object.freeze({id:'numb-pose-owner',playAnimation:(name,options)=>calls.push({name,options})});
 const other=Object.freeze({id:'numb-pose-observer',playAnimation:(name,options)=>otherCalls.push({name,options})});
 try{
  updateNumbVisual(player,true,0);updateNumbVisual(other,true,0);
  suppressNumbVisual(player,1,10);
  assert.deepEqual(calls.map(x=>x.name),['animation.kg_a22.player.numb','animation.kg_a22.player.numb_stop']);
  assert.deepEqual(calls[1].options,{controller:'kg_numb',blendOutTime:0});
  assert.equal(otherCalls.length,1);
  for(let tick=2;tick<11;tick++)updateNumbVisual(player,true,tick);
  assert.equal(calls.length,2,'per-tick effect polling must not restart Numb during the press');
  updateNumbVisual(player,true,11);assert.equal(calls.at(-1).name,'animation.kg_a22.player.numb');
  suppressNumbVisual(player,12,29);suppressNumbVisual(player,13,10);
  updateNumbVisual(player,true,23);updateNumbVisual(player,true,40);
  assert.equal(calls.at(-1).name,'animation.kg_a22.player.numb_stop','a shorter overlapping pose cannot shorten the brush');
  updateNumbVisual(other,true,24);assert.equal(otherCalls.length,2,'another player keeps their own Numb animation');
  updateNumbVisual(player,true,41);assert.equal(calls.at(-1).name,'animation.kg_a22.player.numb');
 }finally{forgetNumbVisual(player.id);forgetNumbVisual(other.id)}
});
test('a newly acquired Numb effect respects the pose, and leave cleanup removes that deadline',()=>{
 const calls=[],player={id:'numb-join-during-pose',playAnimation:name=>calls.push(name)};
 try{
  suppressNumbVisual(player,50,29);updateNumbVisual(player,true,60);
  assert.deepEqual(calls,[]);
  forgetNumbVisual(player.id);
  updateNumbVisual(player,true,61);
  assert.deepEqual(calls,['animation.kg_a22.player.numb'],'a reused player ID must not inherit the departed pose');
 }finally{forgetNumbVisual(player.id)}
});
test('a failed stop retries within suppression without resetting or restarting another controller',()=>{
 const calls=[];let fail=true;
 const player={id:'numb-stop-retry',playAnimation(name,options){
  calls.push({name,options});
  if(name==='animation.kg_a22.player.numb_stop'&&fail){fail=false;throw Error('native stop unavailable')}
 }};
 try{
  updateNumbVisual(player,true,0);suppressNumbVisual(player,1,10);
  updateNumbVisual(player,true,2);updateNumbVisual(player,true,10);
  assert.deepEqual(calls.map(x=>x.name),['animation.kg_a22.player.numb','animation.kg_a22.player.numb_stop','animation.kg_a22.player.numb_stop']);
  assert.ok(calls.every(x=>x.options.controller==='kg_numb'));
  updateNumbVisual(player,true,11);assert.equal(calls.at(-1).name,'animation.kg_a22.player.numb');
 }finally{forgetNumbVisual(player.id)}
});
test('actual physical brush call site suppresses Numb after a successful clip, including native blend-out',()=>{
 const main=fs.readFileSync(new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/main.js',import.meta.url),'utf8');
 const hooks=[...main.matchAll(/try\{player\.playAnimation\('animation\.kg_imm\.player\.brush\.'\+hand,[\s\S]*?\}catch\{\}/g)];
 assert.equal(hooks.length,1,'physical brush retains its legacy hook; Cookery has a separately tested controlled branch');
 for(const [index,[source]] of hooks.entries()){
  const run=Function('player','hand','system','suppressNumbVisual',source),calls=[];
  let fail=false;
  const player={id:'numb-brush-hook-'+index,playAnimation(name){
   if(name.startsWith('animation.kg_imm.player.brush.')&&fail)throw Error('brush clip unavailable');
   calls.push(name);
  }};
  try{
   updateNumbVisual(player,true,100);
   run(player,index?'off':'main',{currentTick:100},suppressNumbVisual);
   assert.equal(calls.at(-1),'animation.kg_a22.player.numb_stop');
   updateNumbVisual(player,true,128);assert.equal(calls.at(-1),'animation.kg_a22.player.numb_stop');
   updateNumbVisual(player,true,129);assert.equal(calls.at(-1),'animation.kg_a22.player.numb');
   fail=true;run(player,'main',{currentTick:130},suppressNumbVisual);
   assert.equal(calls.at(-1),'animation.kg_a22.player.numb','a failed brush start must not suppress Numb');
   updateNumbVisual(player,true,141);assert.equal(calls.at(-1),'animation.kg_a22.player.numb');
   assert.equal(calls.filter(name=>name==='animation.kg_a22.player.numb').length,3);
  }finally{forgetNumbVisual(player.id)}
 }
});

// Exercise the actual refactored Cookery branch with the real Numb runtime, not
// a count of legacy playAnimation spellings. Oil and physical brushes now have
// different successful-pose deadlines (20 and 29 ticks respectively).
const numbMainSource=fs.readFileSync(new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/main.js',import.meta.url),'utf8');
const oilBranchMarker="// both the substitute and arm on switch/cancel or Java's 20-tick endpoint.";
assert.equal(numbMainSource.split(oilBranchMarker).length,2,'locate exactly one actual Cookery visual branch');
const oilBranchSource=numbMainSource.split(oilBranchMarker)[1].split('  }return;')[0];
const runOilBranch=Function('player','hand','oil','system','grillingConfig','beginOilBrushVisual','cancelOilBrushVisual','oilBrushStopExpression','suppressNumbVisual',oilBranchSource);
for(const hand of ['main','off'])for(const enabled of [true,false])for(const published of [true,false])for(const failClip of [true,false])
 test(`actual Cookery Numb gate hand=${hand}, enabled=${enabled}, published=${published}, failedClip=${failClip}`,()=>{
  const calls=[];let starts=0,cancels=0;
  const player={id:`numb-oil-${hand}-${enabled}-${published}-${failClip}`,playAnimation(name,options){
   if(name.startsWith('animation.kg_oil_brush.player.')||name.startsWith('animation.kg_imm.player.brush.')){
    calls.push({name,options});if(failClip)throw Error('brush clip unavailable');
   }else calls.push({name,options});
  }};
  const attempted=!enabled||published,success=attempted&&!failClip,duration=enabled?20:29;
  try{
   updateNumbVisual(player,true,100);
   runOilBranch(player,hand,{type:'canola'},{currentTick:100},()=>({enableOilBrushVisuals:enabled}),()=>{starts++;return published},()=>{cancels++},()=> 'marker changed',suppressNumbVisual);
   assert.equal(starts,enabled?1:0);
   assert.equal(cancels,attempted&&failClip?1:0);
   const clips=calls.filter(x=>x.name.includes('.player.brush.')||x.name.includes('.kg_oil_brush.player.'));
   assert.equal(clips.length,attempted?1:0);
   if(attempted)assert.equal(clips[0].name,(enabled?'animation.kg_oil_brush.player.':'animation.kg_imm.player.brush.')+hand);
   assert.equal(calls.filter(x=>x.name==='animation.kg_a22.player.numb_stop').length,success?1:0,'only a successfully started pose suppresses Numb');
   if(success){
    for(let tick=101;tick<100+duration;tick++)updateNumbVisual(player,true,tick);
    assert.equal(calls.filter(x=>x.name==='animation.kg_a22.player.numb').length,1,'Numb stays suppressed through the complete actual pose deadline');
    updateNumbVisual(player,true,100+duration);
    assert.equal(calls.at(-1).name,'animation.kg_a22.player.numb','Numb resumes at the exact 20/29 tick endpoint');
    assert.equal(calls.filter(x=>x.name==='animation.kg_a22.player.numb').length,2);
   }else{
    updateNumbVisual(player,true,112);
    assert.equal(calls.at(-1).name,'animation.kg_a22.player.numb','publication or clip failure leaves no suppression deadline');
    assert.equal(calls.filter(x=>x.name==='animation.kg_a22.player.numb').length,2);
   }
  }finally{forgetNumbVisual(player.id)}
 });
