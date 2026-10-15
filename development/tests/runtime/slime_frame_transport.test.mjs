import test from 'node:test';
import assert from 'node:assert/strict';
import {slimeFrameAtTick,readSlimeWorldFrame,slimeFramePacket,decodeSlimeFrame,SLIME_ID} from '../../../projects/grilling/gameplay_core/behavior_pack/scripts/slime_frame_core.js';
import {heldVisualKind,writeHeldVisual,heldVisualPropertyNames,forgetHeldVisual,HELD_VISUAL_EMPTY} from '../../../projects/grilling/gameplay_core/behavior_pack/scripts/held_visual_transport.js';

function player(id){return {id,values:new Map(),writes:[],setProperty(k,v){this.writes.push([k,v]);this.values.set(k,v);}};}
function marker(p,hand){return p.values.get(heldVisualPropertyNames(hand)[11]);}

test('global four-tick frame arithmetic, including persistent-world ages',()=>{
 for(const t of [0,3,4,7,8,11,12,15,16,19,20,2**24,2**26,2**28,2**40,2**52,Number.MAX_SAFE_INTEGER]){
  for(let d=0;d<20&&Number.isSafeInteger(t+d);d++)assert.equal(slimeFrameAtTick(t+d),Number((BigInt(t+d)/4n)%5n));
 }
 for(const t of [undefined,null,NaN,Infinity,-1,.25,Number.MAX_SAFE_INTEGER+1])assert.equal(slimeFrameAtTick(t),0);
 assert.equal(readSlimeWorldFrame({getAbsoluteTime(){return 19;}}),4);
 assert.equal(readSlimeWorldFrame({getAbsoluteTime(){throw Error('unavailable');}}),0);
});

test('only the exact cooked slime item owns the reserved marker range',()=>{
 assert.equal(heldVisualKind(SLIME_ID),'slime');
 for(const id of ['kaleidoscope_grilling:raw_slime_skewer',SLIME_ID+'_native_plain',undefined])assert.equal(heldVisualKind(id),'empty');
 for(let frame=0;frame<5;frame++){
  assert.deepEqual(slimeFramePacket(frame),[...Array(11).fill(0),215+frame]);
  assert.equal(decodeSlimeFrame(SLIME_ID,215+frame),frame);
  assert.equal(decodeSlimeFrame('kaleidoscope_grilling:raw_slime_skewer',215+frame),0);
 }
 for(const m of [undefined,0,213,214,220,254,255,215.5,Infinity])assert.equal(decodeSlimeFrame(SLIME_ID,m),0);
});

test('cross-hand cache and switching through bottle, plate, secret and empty',()=>{
 const p=player('switch');
 writeHeldVisual(p,'main','slime',slimeFramePacket(3));
 writeHeldVisual(p,'off','slime',slimeFramePacket(1));
 assert.equal(marker(p,'main'),218);assert.equal(marker(p,'off'),216);
 const n=p.writes.length;assert.equal(writeHeldVisual(p,'main','slime',slimeFramePacket(3)),false);assert.equal(p.writes.length,n);
 for(const [kind,packet] of [['bottle',[...Array(11).fill(0),214]],['plate',[...Array(11).fill(0),255]],['secret',Array(12).fill(0)],['empty',HELD_VISUAL_EMPTY]]){
  writeHeldVisual(p,'main',kind,packet);assert.equal(decodeSlimeFrame(SLIME_ID,marker(p,'main')),0);
  writeHeldVisual(p,'main','slime',slimeFramePacket(3));assert.equal(marker(p,'main'),218);assert.equal(marker(p,'off'),216);
 }
 forgetHeldVisual(p.id);assert.equal(writeHeldVisual(p,'main','slime',slimeFramePacket(3)),true);
});

test('reject cross-kind markers and nonzero slime payload',()=>{
 const p=player('invalid');
 for(const kind of ['secret','bottle','plate','empty'])assert.throws(()=>writeHeldVisual(p,'main',kind,slimeFramePacket(2)));
 for(const value of [214,220,254,255])assert.throws(()=>writeHeldVisual(p,'main','slime',[...Array(11).fill(0),value]));
 const bad=slimeFramePacket(2);bad[0]=1;assert.throws(()=>writeHeldVisual(p,'main','slime',bad));
 assert.equal(p.writes.length,0);
});

test('throwing native write never poisons a retry cache',()=>{
 const p=player('failure');writeHeldVisual(p,'main','slime',slimeFramePacket(0));
 const original=p.setProperty;
 p.setProperty=function(k,v){original.call(this,k,v);throw Error('after native write');};
 assert.throws(()=>writeHeldVisual(p,'main','slime',slimeFramePacket(4)));
 p.setProperty=original;
 assert.equal(writeHeldVisual(p,'main','slime',slimeFramePacket(4)),true);
 assert.equal(marker(p,'main'),219);
});

// Run the actual runtime/transport modules with only native equipment and log
// boundaries substituted. This does not emulate native packet delivery.
import vm from 'node:vm';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const scripts=fileURLToPath(new URL('../../../projects/grilling/gameplay_core/behavior_pack/scripts/',import.meta.url));
async function runtime(){
 const context=vm.createContext({console}),cache=new Map(),errors=[];
 const stubs={
  'a2735_player_io.js':{getMainHand:p=>p.main,getOffHand:p=>p.off},
  'held_visual_dispatch_runtime.js':{reportHeldVisualError:(...args)=>errors.push(args)},
 };
 async function load(file){
  if(cache.has(file))return cache.get(file);
  let mod;
  if(stubs[path.basename(file)]){const exports=stubs[path.basename(file)];mod=new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v]of Object.entries(exports))this.setExport(k,v);},{context,identifier:file});}
  else mod=new vm.SourceTextModule(await fs.readFile(file,'utf8'),{context,identifier:file});
  cache.set(file,mod);
  await mod.link((specifier,ref)=>load(path.resolve(path.dirname(ref.identifier),specifier)));
  return mod;
 }
 const mod=await load(path.join(scripts,'slime_frame_runtime.js'));await mod.evaluate();
 return {api:mod.namespace,errors};
}

test('actual runtime discovers first equip on next existing tick, shares one sample across players/hands',async()=>{
 const {api}=await runtime(),a=player('a'),b=player('b');
 let reads=0;const world={getAbsoluteTime(){reads++;return 19;}};
 api.syncSlimeHeld(a,api.readSlimeWorldFrame(world));assert.equal(a.writes.length,0);
 a.main={typeId:SLIME_ID};a.off={typeId:SLIME_ID};b.off={typeId:SLIME_ID};
 // Before that next tick, missing/stale state deliberately renders frame0.
 assert.equal(decodeSlimeFrame(SLIME_ID,marker(a,'main')),0);
 const frame=api.readSlimeWorldFrame(world);reads=0;
 for(const p of [a,b])api.syncSlimeHeld(p,frame);
 assert.equal(reads,0);assert.equal(marker(a,'main'),219);assert.equal(marker(a,'off'),219);assert.equal(marker(b,'off'),219);
 a.main={typeId:'kaleidoscope_grilling:raw_slime_skewer'};a.off=undefined;
 const before=a.writes.length;api.syncSlimeHeld(a,0);assert.equal(a.writes.length,before);
 assert.equal(decodeSlimeFrame(a.main.typeId,marker(a,'main')),0);
 a.main=undefined;a.off={typeId:SLIME_ID};api.syncSlimeHeld(a,2);assert.equal(marker(a,'off'),217);
});

test('runtime isolates a failed hand and retries next tick',async()=>{
 const {api,errors}=await runtime(),p=player('fault');p.main=p.off={typeId:SLIME_ID};
 const original=p.setProperty;
 p.setProperty=function(k,v){if(k.includes('main'))throw Error('main write unavailable');return original.call(this,k,v);};
 api.syncSlimeHeld(p,3);assert.equal(marker(p,'off'),218);assert.equal(errors.length,1);
 p.setProperty=original;api.syncSlimeHeld(p,4);assert.equal(marker(p,'main'),219);assert.equal(marker(p,'off'),219);
});

test('main integration keeps one world read outside the existing player scan',async()=>{
 const main=await fs.readFile(path.join(scripts,'main.js'),'utf8');
 assert.match(main,/system\.runInterval\(\(\)=>\{\n const slimeFrame=readSlimeWorldFrame\(world\);\n for\(const p of world\.getAllPlayers\(\)\)\{try\{\n  syncSlimeHeld\(p,slimeFrame\);/);
 assert.equal((main.match(/readSlimeWorldFrame\(world\)/g)||[]).length,1);
 const code=await fs.readFile(path.join(scripts,'slime_frame_runtime.js'),'utf8');
 assert.doesNotMatch(code,/runInterval|getAllPlayers|system\.currentTick|q\.time_stamp/);
});
