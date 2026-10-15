// Source/asset/adapter regressions; never Minecraft client acceptance.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {javaEatingHudFrame,validEatingHudPacket,EATING_PACKET_PREFIX,EATING_PACKET_END} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/java_eating_hud_core.js';
import {showJavaEatingHud,forgetJavaEatingHud} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/java_eating_hud_runtime.js';
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
test('active eating adapter aligns partial native countdowns with the full Java bar',()=>{
 const sent=[],handle={id:'partial-countdown',onScreenDisplay:{setActionBar:packet=>sent.push(packet)}};
 const project=(session,tick)=>{
  const before=structuredClone(session),count=sent.length;
  showJavaEatingHud(handle,session,tick);
  assert.equal(sent.length,count+1,'Each call sends synchronously without a queue');
  assert.deepEqual(session,before,'HUD projection must not alter the native eating session');
  const packet=sent.at(-1);assert(validEatingHudPacket(packet));
  return {width:parseInt(packet.slice(9,11),16),ready:packet[11]==='1'};
 };
 try{
  const one={id:'grilled_fish_skewer',profile:'ONE',start:100,nativeDuration:60};
  assert.deepEqual(project(one,100),{width:34,ready:true});
  assert.deepEqual(project(one,159),{width:101,ready:true});
  assert.deepEqual(project(one,160),{width:102,ready:true});
  const three={id:'grilled_fish_skewer',profile:'THREE',start:200,nativeDuration:80};
  assert.deepEqual(project(three,200),{width:20,ready:false});
  assert.deepEqual(project(three,205),{width:26,ready:true});
  assert.deepEqual(project(three,280),{width:102,ready:true});
 }finally{forgetJavaEatingHud(handle.id);}
});
test('active eating adapter preserves full and invalid native duration session clocks',()=>{
 const sent=[],handle={id:'session-countdown',onScreenDisplay:{setActionBar:packet=>sent.push(packet)}};
 try{
  for(const [profile,duration] of [['ONE',90],['THREE',100]]){
   for(const nativeDuration of [duration,undefined,null,0,-1,duration+1,60.5,NaN,Infinity,'60']){
    const session={id:'grilled_fish_skewer',profile,start:500,nativeDuration};
    for(const elapsed of [0,24,25,duration]){
     const count=sent.length;showJavaEatingHud(handle,session,500+elapsed);
     assert.equal(sent.length,count+1);
     assert.equal(sent.at(-1),javaEatingHudFrame({id:session.id,elapsed,duration,tick:500+elapsed}).packet,
      `${profile} nativeDuration=${String(nativeDuration)} elapsed=${elapsed}`);
    }
   }
  }
 }finally{forgetJavaEatingHud(handle.id);}
});
test('eating start publishes an immediate frame only for the configured custom HUD',()=>{
 const main=fs.readFileSync(new URL('projects/grilling/gameplay_core/behavior_pack/scripts/main.js',root),'utf8');
 const start=main.indexOf(' if(a.plain)return;'),end=main.indexOf(' try{e.source.setProperty(EAT_PROFILE_PROPERTY,eatingProfile(profile).code)',start);
 assert.ok(start>0&&end>start,'Native eating start gate must remain identifiable');
 const begin=Function('a','e','system','grillingConfig','showJavaEatingHud',main.slice(start,end));
 const sent=[],handle={id:'immediate-frame',onScreenDisplay:{setActionBar:packet=>sent.push(packet)}};
 try{
  const session={id:'grilled_fish_skewer',profile:'ONE',start:100,nativeDuration:60,plain:false};
  for(const [plain,enabled,count] of [[true,true,0],[false,false,0],[false,true,1]]){
   begin({...session,plain},{source:handle},{currentTick:100},()=>({graphicalEatingHud:enabled}),showJavaEatingHud);
   assert.equal(sent.length,count,'Plain food and disabled HUD must not publish a custom frame');
  }
  assert.equal(parseInt(sent[0].slice(9,11),16),34);
 }finally{forgetJavaEatingHud(handle.id);}
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

test('complete END tokens hide the unconditional base bar with native formatting prefixes',()=>{
 const ui=JSON.parse(fs.readFileSync(new URL('ui/kg_grilling_hud.json',rp)));
 const expression=ui.kg_eating_packet.visible;
 // Evaluate the production text equality/subtraction clauses with native UI
 // string subtraction, then reduce only the restricted boolean expression.
 const packetVisible=text=>{
  let value=expression.replace(/\(\(\$kg_text - '([^']*)'\) = \$kg_text\)/g,
   (_,fragment)=>String(text.replace(fragment,'')===text));
  value=value.replace(/\(\$kg_text = '([^']*)'\)/g,(_,literal)=>String(text===literal));
  value=value.replace(/\bnot\b/g,'!').replace(/\band\b/g,'&&');
  assert.ok(/^[()\s!&truefals]+$/.test(value),'Unexpected UI boolean expression');
  return Function('return '+value)();
 };
 const base=ui.kg_eating_packet.controls.find(row=>row.base).base;
 assert.ok(!('visible' in base),'Original base bar remains parent-gated');
 const frame=javaEatingHudFrame({id:'kaleidoscope_grilling:grilled_fish_skewer',elapsed:25,duration:90}).packet;
 for(const prefix of ['', '§r', '§r§f']){
  assert.equal(packetVisible(prefix+frame),true);
  assert.equal(packetVisible(prefix+EATING_PACKET_END),false,'Completion must hide every child, including the base bar');
 }
 for(const text of ['', 'ordinary message', 'KT_HUD!END;'])assert.equal(packetVisible(text),false);
});

test('factory creation pruning preserves every shipped fill/icon predicate and drops foreign content',()=>{
 const ui=JSON.parse(fs.readFileSync(new URL('ui/kg_grilling_hud.json',rp))),packet=ui.kg_eating_packet;
 assert(!('ignored' in packet),'Outer packet must retain its expiry lifecycle');
 const controls=packet.controls.flatMap(row=>Object.entries(row));
 const base=controls.find(([name])=>name==='base')[1];
 assert.equal(base.ignored,`(not ${packet.visible})`);
 const predicates=new Map();
 function predicate(expression,text){
  if(expression===undefined)return true;
  if(!predicates.has(expression)){
   const fragments=[];
   let body=expression.replace(/\(\(\$kg_text - '([^']*)'\) = \$kg_text\)/g,(_,fragment)=>{
    fragments.push(fragment);return `values[${fragments.length-1}]`;
   }).replace(/\bnot\b/g,'!').replace(/\band\b/g,'&&').replace(/\bor\b/g,'||');
   assert(/^[()\s!&|\[\]0-9values]+$/.test(body),'Unexpected factory predicate');
   const evaluate=Function('values','return '+body);
   predicates.set(expression,text=>evaluate(fragments.map(fragment=>!text.includes(fragment))));
  }
  return predicates.get(expression)(text);
 }
 function project(text,prune){
  const images=[],retained=['packet'],parentVisible=predicate(packet.visible,text);
  for(const [name,image] of controls){
   if(prune&&predicate(image.ignored,text))continue;
   retained.push(name);
   if(parentVisible&&predicate(image.visible,text))images.push(name);
  }
  return {images,retained};
 }
 const fills=controls.filter(([name])=>name.startsWith('fill_')),icons=controls.filter(([name])=>name.startsWith('icon_'));
 for(const [name,image] of [...fills,...icons]){
  assert.equal(image.ignored,`(${base.ignored} or (not ${image.visible}))`);
  const fragment=/^\(not \(\(\$kg_text - '([^']*)'\) = \$kg_text\)\)$/.exec(image.visible)?.[1];
  assert(fragment,'Expected a fixed substring predicate on '+name);
  assert(name.startsWith('fill_')?/^KG_HUD!F:[0-9a-f]{2}[01]$/.test(fragment):/^I:(5a|64)[0-9a-f]{2}[01];$/.test(fragment),
   'F and I selections must remain independent to cover their full domains separately');
 }
 let cases=0,maxSelectedControls=0;
 function conserved(text,expected){
  const before=project(text,false),after=project(text,true);
  assert.deepEqual(after.images,before.images,'Creation pruning changed visible output for '+text);
  assert.deepEqual(after.images,expected);
  assert.equal(after.retained.length,1+expected.length,'Hidden images survived construction pruning');
  maxSelectedControls=Math.max(maxSelectedControls,after.retained.length);cases++;
 }
 const hex=n=>n.toString(16).padStart(2,'0'),iconNames=new Map(icons.map(([name])=>{
  const [,duration,ready,index]=name.split('_');return [`${hex(+duration)}${hex(+index)}${ready}`,name];
 }));
 // The production predicates above prove F/I independence. Exercise every
 // legal token in each full domain instead of repeating their Cartesian product.
 for(const prefix of ['', '§r', '§r§f', '§a§r', '§r§0§r§0']){
  for(let width=0;width<=102;width++)for(const ready of [0,1]){
   const raw=`KG_HUD!F:${hex(width)}${ready}I:5aff${ready};`;
   assert(validEatingHudPacket(raw));
   conserved(prefix+raw+'§r',['base',...(width?[`fill_${ready}_${width}`]:[]),`icon_90_${ready}_255`]);
  }
  for(const duration of [90,100])for(let icon=0;icon<=255;icon++)for(const ready of [0,1]){
   const token=`${hex(duration)}${hex(icon)}${ready}`,raw=`KG_HUD!F:33${ready}I:${token};`;
   assert(validEatingHudPacket(raw));
   conserved(prefix+raw+'§r',['base',`fill_${ready}_51`,...(iconNames.has(token)?[iconNames.get(token)]:[])]);
  }
  for(const text of [EATING_PACKET_END, 'ordinary message', 'KT_HUD!P:20;', 'foreign I:5aff1;'])conserved(prefix+text+'§r',[]);
 }
 assert.equal(maxSelectedControls,4);
 console.log(JSON.stringify({eatingPruningCases:cases,packetDefinitionControls:406,maxSelectedControls,clientTested:false}));
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
