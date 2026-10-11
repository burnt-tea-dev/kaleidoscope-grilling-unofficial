// Source/asset/adapter regressions; never Minecraft client acceptance.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {javaEatingHudFrame} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/java_eating_hud_core.js';
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
   assert.notEqual(f.icon,255);assert.equal(f.packet.replace(/§[0-9a-fr]/g,''),'','graphical transport has no printable text');
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
test('GUI copies all pinned original assets and preserves own packet expiry',()=>{
 const f=JSON.parse(fs.readFileSync(new URL('development/gameplay_core/fixtures/java-hud-1.1.1.json',root)));
 for(const [name,row] of Object.entries(f.assets))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL(name,rp))).digest('hex'),row.sha256,name);
 const ui=JSON.parse(fs.readFileSync(new URL('ui/hud_screen.json',rp)));
 assert.equal(f.machine_hud_default,false);assert.equal(ui.kg_eating_expire.destroy_at_end,'kg_eating_packet');
 assert.equal(ui.kg_eating_expire.duration,.001);
 assert.equal(ui.kg_eating_hold.duration,.1);
 assert.equal(ui.kg_eating_hold.anim_type,'wait');
 assert.equal(ui.kg_eating_hold.next,'@hud.kg_eating_expire');
 assert.equal(ui.kg_eating_start.next,'@hud.kg_eating_hold');
 assert.equal(ui.kg_eating_start.duration,0);
 assert.equal(ui.kg_eating_expire.to,0);
 assert.equal(ui.kg_eating_expire.anim_type,'alpha');
 assert.equal(ui.kg_eating_packet.anims,undefined);
 assert.equal(ui.kg_eating_packet.alpha,'@hud.kg_eating_start');
 assert.equal(ui.kg_eating_expire.end_event,undefined);
 assert.equal(ui.kg_eating_packet.propagate_alpha,true);
assert.equal(ui.kg_eating_packet.controls.length,405);
 assert.ok(ui.hud_actionbar_text.visible.includes('§r[KT]'));
 const script=fs.readFileSync(new URL('projects/grilling/gameplay_core/behavior_pack/scripts/java_eating_hud_runtime.js',root),'utf8');
 assert.ok(!script.includes("setActionBar('')"));assert.ok(!script.includes('runInterval'));
});

// Source-level samples only; client arrivals and rendering require separate native QA.
test('bounded 100 ms hold retains the original intro and 1 ms owned fade',()=>{
 const ui=JSON.parse(fs.readFileSync(new URL('ui/hud_screen.json',rp)));
 assert.deepEqual(ui.kg_eating_start,{anim_type:'alpha',duration:0,from:0,to:1,next:'@hud.kg_eating_hold'});
 assert.deepEqual(ui.kg_eating_hold,{anim_type:'wait',duration:.1,next:'@hud.kg_eating_expire'});
 assert.deepEqual(ui.kg_eating_expire,{anim_type:'alpha',duration:.001,from:1,to:0,destroy_at_end:'kg_eating_packet'});
 const alphaAt=t=>t<ui.kg_eating_hold.duration?1:Math.max(0,1-(t-ui.kg_eating_hold.duration)/ui.kg_eating_expire.duration);
 for(const t of [0,.05,.075,.099,.1])assert.equal(alphaAt(t),1);
 for(const t of [.102,.15,1,30])assert.equal(alphaAt(t),0);
 assert(!('loop' in ui.kg_eating_hold));assert(!('next' in ui.kg_eating_expire));
});
test('HUD authoring generator preserves the committed lifetime declarations',()=>{
 // Read only the literal curve dicts from the generator AST; do not run asset authoring.
 const py=String.raw`import ast,json,sys
from pathlib import Path
module=ast.parse(Path(sys.argv[1]).read_text())
ui=[n.value for n in ast.walk(module) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='ui' for t in n.targets)]
assert len(ui)==1 and isinstance(ui[0],ast.Dict)
wanted={'kg_eating_start','kg_eating_hold','kg_eating_expire'}
curves={k.value:ast.literal_eval(v) for k,v in zip(ui[0].keys,ui[0].values) if isinstance(k,ast.Constant) and k.value in wanted}
assert set(curves)==wanted
print(json.dumps(curves))`;
 const generated=JSON.parse(execFileSync('python3',['-c',py,fileURLToPath(new URL('tools/build_java_eating_hud.py',root))],{encoding:'utf8'}));
 const ui=JSON.parse(fs.readFileSync(new URL('ui/hud_screen.json',rp)));
 for(const key of ['kg_eating_start','kg_eating_hold','kg_eating_expire'])assert.deepEqual(generated[key],ui[key],key);
});
