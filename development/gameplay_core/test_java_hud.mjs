// Source/asset/adapter regressions; never Minecraft client acceptance.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {javaEatingHudFrame,validEatingHudPacket,EATING_PACKET_PREFIX,EATING_PACKET_END} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/java_eating_hud_core.js';
import {javaInteractionMessage,JAVA_INTERACTION_KEYS} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/interaction_feedback_core.js';
const root=new URL('../../',import.meta.url),rp=new URL('projects/grilling/gameplay_core/resource_pack/',root);
test('original keys and argument order; invented hints rejected',()=>{
 assert.deepEqual(javaInteractionMessage('grill_wait_flip',[2,4]),{rawtext:[{translate:'message.kaleidoscope_grilling.grill_wait_flip',with:['2','4']}]});
 assert.deepEqual(javaInteractionMessage('grill_ready_to_take',[],true).rawtext.map(x=>x.text??x.translate),['§c','message.kaleidoscope_grilling.grill_ready_to_take','§r']);
 assert.equal(javaInteractionMessage('flip_cooldown'),undefined);
 for(const locale of ['en_US','zh_CN','zh_TW']){
  const text=fs.readFileSync(new URL(`texts/${locale}.lang`,rp),'utf8');
  for(const key of JAVA_INTERACTION_KEYS)assert.ok(text.includes(`message.kaleidoscope_grilling.${key}=`),`${locale}: ${key}`);
 }
});
test('90/100 tick progress uses 102 pixels and changes at tick 25',()=>{
 for(const duration of [90,100]){
  assert.equal(javaEatingHudFrame({id:'minecraft:unknown',elapsed:0,duration}).width,0);
  for(const elapsed of [24,25,duration,duration+1]){
   const f=javaEatingHudFrame({id:'kaleidoscope_grilling:grilled_fish_skewer',elapsed,duration});
   assert.equal(f.ready,elapsed>=25);assert.equal(f.width,Math.min(102,Math.round(102*elapsed/duration)));
   assert.notEqual(f.icon,255);assert.equal(f.packet.replace(/§[0-9a-fr]/g,''),f.packet,'data survives formatting removal');assert(validEatingHudPacket(f.packet));
  }
 }
 assert.equal(javaEatingHudFrame({elapsed:NaN,duration:90}),undefined);
});
test('slime and failed icons follow original four-tick/five-frame cycle',()=>{
 for(const id of ['grilled_slime_skewer','mysterious_skewer']){
  const icons=Array.from({length:5},(_,i)=>javaEatingHudFrame({id,elapsed:30,duration:90,tick:i*4}).icon);
  assert.ok(!icons.includes(255));assert.equal(new Set(icons).size,5);
  assert.equal(javaEatingHudFrame({id,elapsed:30,duration:90,tick:20}).icon,icons[0]);
 }
});
test('GUI keeps original assets and the original bounded actionbar event factory',()=>{
 const f=JSON.parse(fs.readFileSync(new URL('development/gameplay_core/fixtures/java-hud-1.1.1.json',root)));
 for(const [name,row] of Object.entries(f.assets))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL(name,rp))).digest('hex'),row.sha256,name);
 const ui=JSON.parse(fs.readFileSync(new URL('ui/kg_grilling_hud.json',rp)));
 assert.equal(f.machine_hud_default,false);
 assert.equal(ui.kg_eating_packet.$kg_text,'$actionbar_text');
 assert.equal(ui.kg_eating_factory.factory.name,'hud_actionbar_text_factory');
 assert.equal(ui.kg_eating_factory.factory.max_children_size,1);
 assert.equal(ui.kg_eating_expire.duration,.2);
 assert.equal(ui.kg_eating_packet.controls.length,405);
 const script=fs.readFileSync(new URL('projects/grilling/gameplay_core/behavior_pack/scripts/java_eating_hud_runtime.js',root),'utf8');
 assert.ok(!script.includes('setActionBar'));assert.ok(!script.includes('runInterval'));
});

test('shared progress atlas preserves all original yellow and green crops',()=>{
 execFileSync('python3',[fileURLToPath(new URL('tools/test_java_eating_hud_atlas.py',root))],{stdio:'pipe',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
});

test('eating controls remain registered outside the shared native HUD catalog',()=>{
 // Static load/mount closure only. A selected shared hud_screen file must not
 // own the 405 Grilling states; their independent catalog survives that choice.
 const mount=JSON.parse(fs.readFileSync(new URL('ui/hud_screen.json',rp)));
 const defs=JSON.parse(fs.readFileSync(new URL('ui/_ui_defs.json',rp))).ui_defs;
 const globals=JSON.parse(fs.readFileSync(new URL('ui/_global_variables.json',rp)));
 assert.deepEqual(defs,['ui/kg_grilling_hud.json']);
 const ui=JSON.parse(fs.readFileSync(new URL(defs[0],rp)));
 assert.equal(ui.namespace,'kaleidoscope_grilling_hud');
 assert.equal(globals.$kg_grilling_hud_root,ui.namespace+'.root');
 assert.equal(ui.root.type,'panel');
 assert.deepEqual(ui.root.controls.slice(0,1),[{'kg_java_eating@kaleidoscope_grilling_hud.kg_eating_factory':{}}]);
 assert.equal(ui.kg_eating_packet.controls.length,405);
 assert(!('kg_eating_packet' in mount));assert(!('root_panel' in ui));
 const nativeRoot=mount.root_panel;
 for(const variable of ['$kg_grilling_hud_root','$kt_tavern_hud_root']){
  assert(!Object.hasOwn(nativeRoot,variable+'|default'),'Local empty value shadows installed HUD provider');
  assert.equal(globals[variable+'|default'],'hud.kt_family_empty');
 }
 assert.deepEqual(nativeRoot.modifications,[{array_name:'controls',operation:'insert_back',value:[
  {'kt_family_tavern@$kt_tavern_hud_root':{}},
  {'kt_family_grilling@$kg_grilling_hud_root':{}},
  {'kt_optional_amw@$senluo_amw_hud_root':{}},
  {'kt_optional_amw_boss@$senluo_amw_boss_root':{}}
 ]}]);
 assert.equal(mount.kt_family_empty.type,'panel');
 assert.deepEqual(mount.kt_family_empty.size,[0,0]);
 for(const key of ['hud_actionbar_text','hud_actionbar_text/actionbar_message']){
  const leaf=mount[key];assert.equal(leaf.$kt_family_actionbar_text,'$actionbar_text');
  assert.ok(leaf.visible.includes('!js.'));
  for(const marker of ['§r§0§r§0','§r[KT]'])assert.ok(!leaf.visible.includes(marker));
 }
 assert.deepEqual(mount.hud_actionbar_text,mount['hud_actionbar_text/actionbar_message']);
});

// Test the production event route with a display handle, never a Minecraft player.
const {createGraphicalActionbarTransport}=await import('../../projects/grilling/gameplay_core/behavior_pack/scripts/graphical_actionbar_transport_core.js');
test('eating frames use the original graphical event and never touch title or subtitle routers',()=>{
 const sent=[],display={setActionBar:packet=>sent.push(packet),setTitle(){throw Error('Foreign title touched');},updateSubtitle(){throw Error('Foreign subtitle touched');}},handle={onScreenDisplay:display};
 const sender=createGraphicalActionbarTransport({prefix:EATING_PACKET_PREFIX,validatePacket:validEatingHudPacket,maxLength:36});
 for(const packet of [javaEatingHudFrame({id:'grilled_fish_skewer',elapsed:0,duration:90}).packet,javaEatingHudFrame({id:'grilled_fish_skewer',elapsed:25,duration:100}).packet,EATING_PACKET_END])assert.equal(sender.send(handle,packet),'actionbar_factory');
 assert.equal(sent.length,3);assert.throws(()=>sender.send(handle,EATING_PACKET_PREFIX+'text'),/Invalid graphical/);
 assert.throws(()=>sender.send(handle,'Ordinary foreign message'),/Invalid graphical/);
 const runtime=fs.readFileSync(new URL('projects/grilling/gameplay_core/behavior_pack/scripts/formatting_hud_runtime.js',root),'utf8');
 assert(!/setTitle|ui_load_script|ui_load:/.test(runtime));
 const ui=JSON.parse(fs.readFileSync(new URL('ui/kg_grilling_hud.json',rp)));
 assert.equal(ui.kg_eating_packet.$kg_text,'$actionbar_text');
 assert(!/#hud_title_text_string|channel_cache_probe/.test(JSON.stringify(ui)));
});
