import assert from 'node:assert/strict';
import nodeTest from 'node:test';
import {createFixture} from '../helpers/minecraft-fixture.mjs';
import {KC_API,KC_READY_EVENT,KC_PING_EVENT,KC_REGISTER_EVENT,SOURCE,CARROT_DICE_ID,POTATO_SLICE_ID,CUTS,choppingRecipes,registrationsForReady} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/recipe/basic_chopping_core.js';
import {GUIDE_PAYLOAD} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/guide/payload.js';
import {EVENTS as GUIDE_EVENTS,REVISION as GUIDE_REVISION,SOURCE as GUIDE_SOURCE,CHUNK_SIZE as GUIDE_CHUNK_SIZE,encodeMessages as encodeGuideMessages,installPublisher as installGuidePublisher,prepareEncodeMessages} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/guide/publisher.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};
const rows=choppingRecipes();
t('Cookery public API v1 constants stay exact',()=>{assert.equal(KC_API,1);assert.equal(KC_READY_EVENT,'kaleidoscope_cookery:api_ready');assert.equal(KC_PING_EVENT,'kaleidoscope_cookery:api_ping');assert.equal(KC_REGISTER_EVENT,'kaleidoscope_cookery:register_recipe');assert.equal(SOURCE,'kaleidoscope_grilling')});
t('slice has exactly two conflict-free board recipes',()=>assert.equal(rows.length,2));
const carrot=rows.find(x=>x.recipe.input==='minecraft:carrot');
const potato=rows.find(x=>x.recipe.input==='minecraft:potato');
t('carrot matches Java 4-cut x3 recipe',()=>assert.deepEqual(carrot.recipe,{id:'kaleidoscope_grilling:chopping_board/carrot_dice',input:'minecraft:carrot',result:CARROT_DICE_ID,count:3,cuts:4}));
t('potato matches Java 4-cut x3 recipe',()=>assert.deepEqual(potato.recipe,{id:'kaleidoscope_grilling:chopping_board/potato_slice',input:'minecraft:potato',result:POTATO_SLICE_ID,count:3,cuts:4}));
t('all recipes use chopping_board kind and source',()=>{for(const r of rows){assert.equal(r.kind,'chopping_board');assert.equal(r.source,SOURCE);assert.equal(r.api,1)}});
t('wrong API registers nothing',()=>assert.deepEqual(registrationsForReady({api:2,capabilities:['chopping_board']}),[]));
t('missing capability registers nothing',()=>assert.deepEqual(registrationsForReady({api:1,capabilities:['millstone']}),[]));
t('chopping_board capability registers both',()=>assert.equal(registrationsForReady({api:1,capabilities:['chopping_board']}).length,2));
t('returned recipes are defensive copies',()=>{const a=choppingRecipes();a[0].recipe.count=99;assert.equal(choppingRecipes()[0].recipe.count,3)});
console.log('A2.7.8 basic chopping core: '+n+'/'+n);

const drain=job=>{let step;do{step=job.next()}while(!step.done);return step.value};
const guideReady=()=>({id:GUIDE_EVENTS.ready,message:JSON.stringify({api:1})});
const guideTransferMessages=messages=>messages.filter(row=>[GUIDE_EVENTS.begin,GUIDE_EVENTS.chunk,GUIDE_EVENTS.end].includes(row.id));
function reassembleGuide(messages,payload){
 const transfer=guideTransferMessages(messages),begin=transfer[0],end=transfer.at(-1);
 assert.equal(begin.id,GUIDE_EVENTS.begin);assert.equal(end.id,GUIDE_EVENTS.end);
 const envelope=JSON.parse(begin.message),chunks=transfer.slice(1,-1);
 assert.equal(envelope.api,1);assert.equal(envelope.source,GUIDE_SOURCE);assert.equal(envelope.id,payload.id);assert.equal(envelope.revision,GUIDE_REVISION);
 assert.equal(chunks.length,envelope.chunks);assert.ok(chunks.length<=512);let raw='';
 for(let index=0;index<chunks.length;index++){
  const fields=chunks[index].message.split('\n');assert.equal(chunks[index].id,GUIDE_EVENTS.chunk);
  assert.deepEqual(fields.slice(0,4),[GUIDE_SOURCE,payload.id,GUIDE_REVISION,String(index)]);
  assert.ok(fields.slice(4).join('\n').length<=GUIDE_CHUNK_SIZE);raw+=fields.slice(4).join('\n');
 }
 assert.deepEqual(JSON.parse(raw),payload);
 assert.deepEqual(JSON.parse(end.message),{api:1,source:GUIDE_SOURCE,id:payload.id,revision:GUIDE_REVISION});
 for(const message of transfer){assert.ok(message.message.length<=2048);assert.doesNotMatch(message.message,/[^\x00-\x7f]/)}
 return transfer;
}

nodeTest('guide publisher generator and synchronous tooling preserve Cookery v1 packets',()=>{
 const messages=encodeGuideMessages(GUIDE_PAYLOAD);
 assert.deepEqual(messages,drain(prepareEncodeMessages(GUIDE_PAYLOAD)));
 reassembleGuide(messages,GUIDE_PAYLOAD);
});
nodeTest('guide publisher prepares asynchronously and repeated ready events share one job',async t=>{
 const f=createFixture();t.after(()=>f.dispose());const {installPublisher}=await f.load('guide/publisher.js');
 const publisher=installPublisher(f.system,GUIDE_PAYLOAD,()=>{});
 assert.equal(publisher.getStatus().preparing,true);assert.equal(f.scriptEvents.some(row=>row.id===GUIDE_EVENTS.begin),false);
 f.tick(1);assert.ok(publisher.getStatus().preparationSteps>0&&publisher.getStatus().preparationSteps<=16);
 assert.equal(publisher.getStatus().preparing,true,'the first scheduled slice does not finish the full guide');
 const queued=f.pendingJobs().length;for(let i=0;i<15;i++)f.emit('system.afterEvents.scriptEventReceive',guideReady());
 assert.equal(publisher.getStatus().preparationBuilds,1);assert.equal(f.pendingJobs().length,queued);
 assert.equal(f.scriptEvents.some(row=>row.id===GUIDE_EVENTS.begin),false);
 let ticks=0;while(publisher.getStatus().preparing&&ticks++<1000)f.tick(1);
 assert.equal(publisher.getStatus().preparing,false);assert.equal(f.scriptEvents.some(row=>row.id===GUIDE_EVENTS.begin),false);
 ticks=0;while(!publisher.getStatus().successfulTransfers&&ticks++<1000)f.tick(1);
 assert.deepEqual(reassembleGuide(f.scriptEvents,GUIDE_PAYLOAD),encodeGuideMessages(GUIDE_PAYLOAD));
 assert.equal(publisher.getStatus().successfulTransfers,1);
});
nodeTest('guide publisher dispose cancels preparation, ping and publication jobs',async t=>{
 const f=createFixture();t.after(()=>f.dispose());const {installPublisher}=await f.load('guide/publisher.js');
 const publisher=installPublisher(f.system,GUIDE_PAYLOAD,()=>{});f.tick(1);f.emit('system.afterEvents.scriptEventReceive',guideReady());
 publisher.dispose();assert.equal(publisher.getStatus().disposed,true);assert.equal(f.pendingJobs().length,0);
 const sent=f.scriptEvents.length;f.tick(300);assert.equal(f.scriptEvents.length,sent);
 assert.equal(f.scriptEvents.some(row=>row.id===GUIDE_EVENTS.begin),false);
});
nodeTest('guide publisher send failure retries cached packets without rebuilding',async t=>{
 const f=createFixture();t.after(()=>f.dispose());const {installPublisher}=await f.load('guide/publisher.js');
 const original=f.system.sendScriptEvent.bind(f.system);let failBegin=true;
 f.system.sendScriptEvent=(id,message)=>{if(id===GUIDE_EVENTS.begin&&failBegin){failBegin=false;throw new Error('one-shot begin failure')}original(id,message)};
 const publisher=installPublisher(f.system,GUIDE_PAYLOAD,()=>{});f.emit('system.afterEvents.scriptEventReceive',guideReady());
 let ticks=0;while(publisher.getStatus().preparing&&ticks++<1000)f.tick(1);f.tick(1);
 assert.equal(publisher.getStatus().sendFailures,1);assert.equal(publisher.getStatus().successfulTransfers,0);
 assert.equal(publisher.getStatus().preparationBuilds,1);
 ticks=0;while(!publisher.getStatus().successfulTransfers&&ticks++<1000)f.tick(1);
 assert.equal(publisher.getStatus().successfulTransfers,1);assert.equal(publisher.getStatus().preparationBuilds,1);
 reassembleGuide(f.scriptEvents,GUIDE_PAYLOAD);
});
nodeTest('guide publisher sends the maximum 514-packet transfer at two packets per tick within the host TTL',async t=>{
 const f=createFixture();t.after(()=>f.dispose());const {installPublisher}=await f.load('guide/publisher.js');
 const base={api:1,id:'kg_a1:grilling',data:''},serialized=JSON.stringify(base);
 const maxPayload={...base,data:'x'.repeat(512*GUIDE_CHUNK_SIZE-serialized.length)};
 assert.equal(JSON.stringify(maxPayload).length,512*GUIDE_CHUNK_SIZE);
 const publisher=installPublisher(f.system,maxPayload,()=>{}),byTick=new Map();
 const original=f.system.sendScriptEvent.bind(f.system);
 f.system.sendScriptEvent=(id,message)=>{
  if([GUIDE_EVENTS.begin,GUIDE_EVENTS.chunk,GUIDE_EVENTS.end].includes(id))byTick.set(f.system.currentTick,(byTick.get(f.system.currentTick)??0)+1);
  original(id,message);
 };
 f.emit('system.afterEvents.scriptEventReceive',guideReady());
 let ticks=0;while(!publisher.getStatus().successfulTransfers&&ticks++<1000)f.tick(1);
 assert.equal(publisher.getStatus().successfulTransfers,1);
 const transfer=reassembleGuide(f.scriptEvents,maxPayload),beginTick=[...byTick.keys()][0],endTick=[...byTick.keys()].at(-1);
 assert.equal(transfer.length,514);
 assert.ok([...byTick.values()].every(count=>count<=2));
 assert.equal(Math.ceil(transfer.length/2),257);
 assert.ok(endTick-beginTick<600,'maximum transfer finishes before the host TTL');
});
