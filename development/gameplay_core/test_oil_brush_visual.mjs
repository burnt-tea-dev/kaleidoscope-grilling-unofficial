// Runtime API doubles only: no claim about native engine rendering.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as core from '../../projects/grilling/gameplay_core/behavior_pack/scripts/oil_brush_visual_core.js';
import {CONFIG_DEFAULTS} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/server_config_core.js';
import {heldVisualKind,writeHeldVisual,heldVisualPropertyNames} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/held_visual_transport.js';
const scripts=new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/',import.meta.url);
const source=fs.readFileSync(new URL('oil_brush_visual_runtime.js',scripts),'utf8').replace(/^import\b[\s\S]*?;\s*/gm,'').replace(/\bexport (?=function)/g,'');
let seq=0;
function fixture(){
 const properties=new Map(),events={},system={currentTick:100};let main,off,provider,enabled=true,fail;
 const player={id:'brush-'+seq++,selectedSlotIndex:2,dimension:{id:'overworld'},setProperty(k,v){if(fail?.(k,v))throw Error('write failure');properties.set(k,v)}};
 const world={afterEvents:{entityDie:{subscribe(cb){events.die=cb}}}};
 const context=vm.createContext({...core,system,world,grillingConfig:()=>({enableOilBrushVisuals:enabled}),getMainHand:()=>main,getOffHand:()=>off,
  readCookeryOilPot:s=>({empty:s.typeId.endsWith(':oil_pot'),type:s.oilType??''}),stackIntentSignature:s=>s?JSON.stringify(s):null,writeHeldVisual,heldVisualPropertyNames,
  invalidateHeldVisual:(p,h)=>p.setProperty(heldVisualPropertyNames(h)[11],254),HELD_VISUAL_EMPTY:Array(12).fill(0),
  registerHeldVisualProvider:(n,s,o)=>{provider={sync:s,...o}},reportHeldVisualError:()=>{}});
 vm.runInContext(source,context);const api=vm.runInContext('({beginOilBrushVisual,syncOilBrushVisual,cancelOilBrushVisual,oilBrushStopExpression})',context);
 return {api,player,system,events,get provider(){return provider},get main(){return main},set main(v){main=v},get off(){return off},set off(v){off=v},set enabled(v){enabled=v},set fail(v){fail=v},word:h=>properties.get(heldVisualPropertyNames(h)[0]),marker:h=>properties.get(heldVisualPropertyNames(h)[11])};
}
function pot(empty=false){return Object.freeze({typeId:'kaleidoscope_cookery:oil_pot'+(empty?'':'_filled'),amount:1,nameTag:'custom',count:empty?0:7})}
test('default is enabled for deterministic always-associated geometry selection',()=>assert.equal(CONFIG_DEFAULTS.enableOilBrushVisuals,true));
for(const hand of ['main','off'])for(const type of ['canola','secret_chili','premium_chili'])for(const empty of [false,true])test(hand+' '+type+' '+(empty?'depleted':'filled')+' exact duration and preservation',()=>{
 const f=fixture(),stack=pot(empty);f[hand]=stack;f[hand==='main'?'off':'main']=pot();
 assert.equal(f.api.beginOilBrushVisual(f.player,hand,type),true);
 for(let i=0;i<20;i++){f.system.currentTick=100+i;f.api.syncOilBrushVisual(f.player);assert.equal(f.marker(hand),225);assert.equal(f.word(hand),1+20*core.oilBrushType(type)+i);assert.strictEqual(f[hand],stack);assert.equal(f.marker(hand==='main'?'off':'main'),226)}
 f.system.currentTick=120;f.api.syncOilBrushVisual(f.player);assert.equal(f.marker(hand),226);assert.strictEqual(f[hand],stack);
});
for(const hand of ['main','off'])for(const reason of ['metadata','emptyhand','slot','dimension','cancel','restart','death','respawn','disable'])test(hand+' '+reason+' cancels safely',()=>{
 const f=fixture();f[hand]=pot();f.api.beginOilBrushVisual(f.player,hand,'secret_chili');
 if(reason==='metadata')f[hand]={...f[hand],nameTag:'changed'};
 if(reason==='emptyhand')f[hand]=undefined;
 if(reason==='slot')f.player.selectedSlotIndex++;
 if(reason==='dimension')f.player.dimension={id:'nether'};
 if(reason==='cancel')f.api.cancelOilBrushVisual(f.player);
 if(reason==='death')f.events.die({deadEntity:{typeId:'minecraft:player',id:f.player.id}});
 if(reason==='respawn')f.provider.spawn(f.player.id);
 if(reason==='disable')f.enabled=false;
 if(reason==='restart'){f.system.currentTick=110;f.api.beginOilBrushVisual(f.player,hand,'premium_chili');f.system.currentTick=120;f.api.syncOilBrushVisual(f.player);assert.equal(f.word(hand),51);return}
 f.system.currentTick=101;f.api.syncOilBrushVisual(f.player);
 if(reason==='emptyhand')return; // new item's provider owns marker; item-name gate hides old brush immediately.
 assert.equal(f.marker(hand),reason==='slot'&&hand==='off'?225:226);
});
test('failed initial publication cancels rather than reviving with an uncontrolled legacy clip',()=>{
 const f=fixture();f.main=pot();let reject=true;f.fail=(k,v)=>k===heldVisualPropertyNames('main')[0]&&reject?(reject=false,true):false;
 assert.equal(f.api.beginOilBrushVisual(f.player,'main','canola'),false);assert.equal(f.marker('main'),226);
 f.api.syncOilBrushVisual(f.player);assert.equal(f.marker('main'),226);
});
test('new non-pot provider must never be overwritten on cancellation',()=>{
 const f=fixture();f.main=pot();f.api.beginOilBrushVisual(f.player,'main','canola');f.main={typeId:'kaleidoscope_grilling:skewer_plate'};
 f.player.setProperty(heldVisualPropertyNames('main')[11],255);f.api.syncOilBrushVisual(f.player);assert.equal(f.marker('main'),255);
});
test('transport accepts only bounded brush payload and keeps shared-owner switching',()=>{
 const f=fixture();assert.equal(heldVisualKind(pot().typeId),'oilbrush');
 for(const type of [0,1,2])for(let t=0;t<20;t++)writeHeldVisual(f.player,'main','oilbrush',core.oilBrushPacket(type,t));
 for(const value of [0,61,-1,1.5])assert.throws(()=>writeHeldVisual(f.player,'main','oilbrush',[value,...Array(10).fill(0),225]));
 assert.throws(()=>core.oilBrushPacket(3,0));assert.throws(()=>core.oilBrushPacket(0,20));
});
test('stop expression pins exact hand and post-consumption filled or empty pot',()=>{
 const f=fixture();for(const hand of ['main','off']){const s=f.api.oilBrushStopExpression(hand);assert.ok(s.includes(heldVisualPropertyNames(hand)[11]));assert.ok(s.includes(hand==='main'?'slot.weapon.mainhand':'slot.weapon.offhand'));assert.ok(s.includes("'kaleidoscope_cookery:oil_pot'"));assert.ok(s.includes('!= 225'))}
});

test('idle renderer selects all five post-transaction states independently per hand',()=>{const f=fixture();for(const [index,type] of ['', '', 'canola','secret_chili','premium_chili'].entries()){f.main={...pot(index===0),oilType:type};f.api.syncOilBrushVisual(f.player);assert.equal(f.marker('main'),226);assert.equal(f.word('main'),index)}});

const mainSource=fs.readFileSync(new URL('main.js',scripts),'utf8');
const branch=mainSource.split('// both the substitute and arm on switch/cancel or Java\'s 20-tick endpoint.')[1].split('  }return;')[0];
for(const enabled of [true,false])for(const published of [true,false])for(const throwAnimation of [true,false])test('actual main brush call integration '+[enabled,published,throwAnimation],()=>{
 const clips=[],suppressed=[];let cancels=0,starts=0;
 const context={player:{playAnimation:(name,options)=>{clips.push({name,options});if(throwAnimation)throw Error('animation failure')}},hand:'off',oil:{type:'secret_chili'},system:{currentTick:100},grillingConfig:()=>({enableOilBrushVisuals:enabled}),beginOilBrushVisual:()=>{starts++;return published},cancelOilBrushVisual:()=>{cancels++},oilBrushStopExpression:()=>"q.property('kaleidoscope_grilling:secret_off_piece') != 225",suppressNumbVisual:(p,t,d)=>suppressed.push(d)};
 vm.runInNewContext(branch,context);
 assert.equal(starts,enabled?1:0);
 assert.equal(clips.length,!enabled||published?1:0);
 if(clips.length){assert.equal(clips[0].name,enabled?'animation.kg_oil_brush.player.off':'animation.kg_imm.player.brush.off');if(enabled){assert.equal(clips[0].options.blendOutTime,0);assert.ok(clips[0].options.stopExpression.includes('225'))}}
 assert.equal(cancels,throwAnimation&&clips.length?1:0);
 assert.deepEqual(suppressed,clips.length&&!throwAnimation?[enabled?20:29]:[]);
});

test('G153 transport owners are disjoint across every byte marker and both hands',()=>{
 const owners={secret:new Set([...Array.from({length:214},(_,i)=>i),221,222,223,224]),bottle:new Set([214]),slime:new Set([215,216,217,218,219]),failure:new Set([220]),oilbrush:new Set([225]),oilpot:new Set([226]),plate:new Set([255])};
 assert.equal(core.OIL_BRUSH_MARKER,225);assert.equal(core.OIL_POT_IDLE_MARKER,226);
 for(const hand of ['main','off'])for(const [kind,markers] of Object.entries(owners))for(let marker=0;marker<=255;marker++){
  const player={id:'allocation-'+seq++,setProperty(){}};
  const values=[kind==='oilbrush'?1:0,...Array(10).fill(0),marker];
  if(markers.has(marker))assert.doesNotThrow(()=>writeHeldVisual(player,hand,kind,values),kind+':'+marker);
  else assert.throws(()=>writeHeldVisual(player,hand,kind,values),/invalid held visual owner/,kind+':'+marker);
 }
});
test('G153 keeps remote extended secret, failure food and plate word bounds',()=>{
 const player={id:'remote-bounds-'+seq++,setProperty(){}};
 for(const hand of ['main','off']){
  for(const marker of [221,222,223,224])assert.doesNotThrow(()=>writeHeldVisual(player,hand,'secret',[521433,683220,...Array(9).fill(0),marker]));
  assert.doesNotThrow(()=>writeHeldVisual(player,hand,'failure',[19,63,217,...Array(8).fill(0),220]));
  assert.throws(()=>writeHeldVisual(player,hand,'failure',[19,63,218,...Array(8).fill(0),220]));
  assert.doesNotThrow(()=>writeHeldVisual(player,hand,'plate',[521433,683220,...Array(8).fill(0),5,255]));
  assert.throws(()=>writeHeldVisual(player,hand,'plate',[521433,683221,...Array(8).fill(0),5,255]));
 }
});
