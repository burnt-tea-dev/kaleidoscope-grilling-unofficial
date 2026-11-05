import test from 'node:test';
import assert from 'node:assert/strict';
import {createFixture} from '../helpers/minecraft-fixture.mjs';

function applySnapshot(request,frame,variables={}){
 // Execute the actual generated native request against its query boundary.
 // This checks packet commit/gating, not Minecraft client variable scope.
 const expression=request.stopExpression.replace('?{','?(()=>{').replace('};return','})():0;return');
 Function('q','v',expression)({property:()=>frame},variables);
 return variables;
}

for(const phase of ['before','after'])test('returning to the previous held snapshot recovers a failed '+phase+' animation submit',async()=>{
 const f=createFixture({deferredProperties:true});
 try{
  const transport=await f.load('held_visual_transport.js');
  const bottle=await f.load('bottle_held_visual_core.js');
  const player=f.player(),empty=transport.HELD_VISUAL_EMPTY;
  const full=[...bottle.bottleHeldVisualPlan('kaleidoscope_grilling:pending_seasoning_f3',[
   'kaleidoscope_grilling:green_chili_powder','kaleidoscope_grilling:sichuan_pepper','kaleidoscope_grilling:onion_powder'
  ]),0,0,0,transport.HELD_VISUAL_BOTTLE];
  transport.writeHeldVisual(player,'main','empty',empty);
  transport.writeHeldVisual(player,'off','bottle',full);
  assert.equal(transport.flushHeldVisual(player,0),true);f.tick();
  const first=player.animations[0];
  assert.equal(player.getProperty(transport.FRAME_PROPERTY),1);

  transport.writeHeldVisual(player,'main','bottle',full);
  transport.writeHeldVisual(player,'off','empty',empty);
  f.faults.failNext(player,'playAnimation',{phase});
  assert.throws(()=>transport.flushHeldVisual(player,1));f.tick();
  assert.equal(player.getProperty(transport.FRAME_PROPERTY),2,'native property was staged before the animation submit failed');
  const failed=phase==='after'?player.animations.at(-1):undefined;

  transport.writeHeldVisual(player,'main','empty',empty);
  transport.writeHeldVisual(player,'off','bottle',full);
  assert.equal(transport.flushHeldVisual(player,2),true,'an unfinished generation cannot deduplicate against older sent data');
  f.tick();const frame=player.getProperty(transport.FRAME_PROPERTY),request=player.animations.at(-1);
  assert.equal(frame,3);
  const variables=applySnapshot(request,frame);
  for(const [hand,words] of [['main',empty],['off',full]])for(let i=0;i<12;i++){
   assert.equal(variables[transport.variableName(hand,i).slice(2)],words[i]);
  }
  const before=structuredClone(variables);
  applySnapshot(first,frame,variables);
  if(failed)applySnapshot(failed,frame,variables);
  assert.deepEqual(variables,before,'late old/failed packets cannot replace the recovered generation');
  assert.equal(transport.flushHeldVisual(player,3),false,'acknowledged unchanged data becomes quiet again');
 }finally{f.dispose()}
});
