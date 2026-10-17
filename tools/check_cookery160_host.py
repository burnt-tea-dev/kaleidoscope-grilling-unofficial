"""Verify reviewed author hooks and retained foreign oil routes, outside packaging."""
from pathlib import Path
import hashlib,json,os,subprocess,tempfile,urllib.request,zipfile
ROOT=Path(__file__).resolve().parents[1]
BP=ROOT/'projects/grilling/gameplay_core/behavior_pack'
def check_guide_locale_registry(original,patched,base,author_fixed=False):
 # Exercise the actual pinned author begin/chunk/end consumer in both forms.
 # SDK event/scheduler doubles are transport witnesses, not Minecraft players.
 fixture=r'''
import assert from 'node:assert/strict';
const locales=['zh_CN','zh_TW','en_US'],bad=['zh_cn','ZH_CN','zh-CN','en__US','en_US:fake',''];
const localized=Object.fromEntries(locales.map(locale=>[locale,['Instructions '+locale]]));
const row={api:1,id:'locale_regression:guide',categories:[{id:'gear'},{id:'BadCategory'}],entries:[{id:'locale_regression:item',category:'gear',mechanics:['Fallback'],mechanicsByLocale:{...localized,...Object.fromEntries(bad.map(locale=>[locale,['Invalid locale']]))}}],names:Object.fromEntries(locales.map(locale=>[locale,{'locale_regression:item':'Name '+locale}])),text:Object.fromEntries(locales.map(locale=>[locale,{title:'Title '+locale}]))};
const envelope={api:1,source:'locale_regression',id:row.id,revision:'locale_1',chunks:1};
function register(payload,envelopeRow=envelope){
 receive({id:KC_GUIDEBOOK_BEGIN_EVENT,message:JSON.stringify(envelopeRow)});
 receive({id:KC_GUIDEBOOK_CHUNK_EVENT,message:[envelopeRow.source,envelopeRow.id,envelopeRow.revision,0,JSON.stringify(payload)].join('\n')});
 receive({id:KC_GUIDEBOOK_END_EVENT,message:JSON.stringify(envelopeRow)});
}
const before=JSON.stringify(row);register(row);const accepted=getGuidebookExtension(row.id);
assert.ok(accepted);assert.equal(accepted.categories.length,1);assert.deepEqual(Object.keys(accepted.names).sort(),[...locales].sort());
const mechanics=accepted.entries[0].mechanicsByLocale;
if(PATCHED||AUTHOR_FIXED){
 assert.deepEqual(Object.keys(mechanics).sort(),[...locales].sort());
 for(const locale of locales)assert.deepEqual(mechanics[locale],localized[locale]);
 for(const locale of bad)assert.equal(mechanics[locale],undefined);
 if(!AUTHOR_FIXED){
  assert.equal(publicGuideLocale(' zh_CN '),'zh_CN');
  for(const locale of bad)assert.equal(publicGuideLocale(locale),'');
 }
}else{
 for(const locale of locales)assert.equal(mechanics[locale],undefined,'Clean original reproduces lost '+locale+' mechanics');
 assert.deepEqual(mechanics.zh_cn,['Invalid locale']);
}
// General token IDs retain lowercase-only validation outside the locale loop.
register({...row,version:'invalid source accepted'},{...envelope,source:'BadSource'});
assert.equal(getGuidebookExtension(row.id),accepted);
register({...row,version:'invalid revision accepted'},{...envelope,revision:'BadRevision'});
assert.equal(getGuidebookExtension(row.id),accepted);assert.equal(JSON.stringify(row),before);
console.log(AUTHOR_FIXED?'Cookery 1.6.1 actual author registry retains three locales and rejects malformed locales/general tokens PASS':PATCHED?'Cookery 1.6.0 patched actual registry retains three locales and rejects malformed locales/general tokens PASS':'Cookery 1.6.0 clean actual registry reproduces missing canonical locale mechanics; names retained PASS');
'''
 stub='let receive;const system={currentTick:0,afterEvents:{scriptEventReceive:{subscribe(fn){receive=fn}}},run(){},runInterval(){return 1},clearRun(){},sendScriptEvent(){}};\n'
 author_import='import { system } from "@minecraft/server";'
 helper_import='import {publicGuideLocale} from "./guide_labels_core.js";\n'
 assert original.count(author_import)==1 and patched.count(author_import)==1
 if author_fixed:
  assert original==patched, 'Retired locale hook must not modify the author fix'
  assert original.count('const safeLocale=/^[a-z]{2}_[A-Z]{2}$/.test(String(locale ?? "")) ? String(locale) : "";')==1
  assert helper_import not in patched and 'const cleanToken=publicGuideLocale;' not in patched
 else:
  assert original.count('const safeLocale=cleanToken(locale);')==1
  assert patched.count('const cleanToken=publicGuideLocale;')==1
 generic='function cleanToken(value) {\n  const s = String(value ?? "").trim();\n  return /^[a-z0-9_.-]+$/.test(s) ? s : "";\n}'
 assert generic in original and generic in patched
 for active,text in [(False,original),(True,patched)]:
  text=text.replace(author_import,'')
  if active and not author_fixed:
   assert text.count(helper_import)==1
   text=text.replace(helper_import,'import {publicGuideLocale} from '+json.dumps((BP/'scripts/host_api/guide_labels_core.js').as_uri())+';\n')
  path=base/('guide-locale-patched.mjs' if active else 'guide-locale-original.mjs')
  path.write_text(stub+text+'\nconst PATCHED='+str(active).lower()+';const AUTHOR_FIXED='+str(author_fixed).lower()+';\n'+fixture)
  subprocess.run(['node',str(path)],check=True)
def check_tavern_guide_bridge():
 # Protocol/scheduler adapter doubles only; no Minecraft runtime or bot.
 module=(BP/'scripts/host_api/guide_labels_core.js').as_uri()
 fixture="import {createTavernGuideBridge,TAVERN_GUIDE_CHAPTER as C,TAVERN_GUIDE_EVENTS as E} from "+json.dumps(module)+";\n"+r"""
import assert from 'node:assert/strict';
function adapter(){
 let receive,leave,sequence=0;const scheduled=new Map(),sent=[],returned=[];
 const system={currentTick:0,afterEvents:{scriptEventReceive:{subscribe(fn){receive=fn}}},runTimeout(fn,ticks){const id=++sequence;scheduled.set(id,{fn,at:this.currentTick+ticks});return id},clearRun(id){scheduled.delete(id)},run(fn){return this.runTimeout(fn,1)}};
 const world={afterEvents:{playerLeave:{subscribe(fn){leave=fn}}}};
 const caller={id:'ui-caller',typeId:'minecraft:player',isValid:true,runCommand(command){const [verb,event,...rest]=command.split(' ');assert.equal(verb,'scriptevent');sent.push({event,row:JSON.parse(rest.join(' '))});}};
 const bridge=createTavernGuideBridge({system,world,onReturn:(owner,outcome)=>returned.push([owner.id,outcome]),warn:()=>{}});
 const advance=async n=>{for(let i=0;i<n;i++){system.currentTick++;for(const [id,row]of [...scheduled])if(row.at<=system.currentTick){scheduled.delete(id);row.fn();}await Promise.resolve();await Promise.resolve();}};
 const emit=(event,row,source=caller)=>receive({id:event,message:JSON.stringify(row),sourceEntity:source});
 return {system,caller,bridge,sent,returned,advance,emit,leave:id=>leave({playerId:id})};
}
const happy=adapter();assert.equal(await happy.bridge.open(happy.caller,'foreign:chapter','en_US'),false);assert.equal(await happy.bridge.open(happy.caller,C,'other'),false);assert.equal(happy.sent.length,0);
const opening=happy.bridge.open(happy.caller,C,'en_US'),request=happy.sent[0].row;
for(const [change,source]of [[{nonce:'wrong'},happy.caller],[{locale:'zh_TW'},happy.caller],[{},undefined],[{},{id:'another',typeId:'minecraft:player'}],[{},{id:request.playerId,typeId:'minecraft:zombie'}]])happy.emit(E.ack,{...request,...change,ok:true},source===undefined?null:source);
assert.equal(happy.sent.length,1);happy.emit(E.ack,{...request,ok:true});assert.equal(await opening,true);assert.equal(happy.sent[1].event,E.start);assert.deepEqual(happy.sent[1].row,request);
happy.emit(E.ack,{...request,ok:true});assert.equal(happy.sent.length,2);assert.equal(await happy.bridge.open(happy.caller,C,'en_US'),true);assert.equal(happy.sent.length,2);
happy.emit(E.return,{...request,outcome:'back'},{id:'another',typeId:'minecraft:player'});assert.equal(happy.returned.length,0);happy.emit(E.return,{...request,outcome:'back'});happy.emit(E.return,{...request,outcome:'back'});await happy.advance(1);assert.deepEqual(happy.returned,[[request.playerId,'back']]);
for(const outcome of ['closed','unavailable']){const a=adapter(),p=a.bridge.open(a.caller,C,'zh_TW'),r=a.sent[0].row;a.emit(E.ack,{...r,ok:true});assert.equal(await p,true);a.emit(E.return,{...r,outcome});await a.advance(1);assert.equal(a.returned.length,outcome==='closed'?0:1);}
for(const mode of ['declined','timeout','leave','send_failed']){const a=adapter();if(mode==='send_failed')a.caller.runCommand=()=>{throw Error('unavailable')};const p=a.bridge.open(a.caller,C,'zh_CN'),r=a.sent[0]?.row;if(mode==='declined')a.emit(E.ack,{...r,ok:false});else if(mode==='timeout')await a.advance(40);else if(mode==='leave')a.leave(a.caller.id);assert.equal(await p,mode==='leave');if(r)a.emit(E.ack,{...r,ok:true});assert.equal(a.sent.filter(x=>x.event===E.start).length,0);await a.advance(40);assert.equal(a.returned.length,0);}
console.log('Tavern chapter acknowledged handoff, source/nonce matching, timeout fallback and return cleanup PASS; no rendered-client acceptance');
"""
 subprocess.run(['node','--input-type=module','-e',fixture],check=True)
def check(author161=False):
 spec=json.loads((BP/'host-extensions/board-api.json').read_text())
 if author161:
  version='1.6.1';archive_env='COOKERY_161_ARCHIVE';file_path='9123/386'
  assert spec['id']=='kaleidoscope_grilling:family-api-0.2.12' and spec['host_uuid']=='d0ca7a68-2877-4bd5-bc82-6c7b325cccf2' and spec['version']==[0,2,12]
  assert spec['archive_sha256']=='5b01865d4dd9a455cd80dae4ddc94dc45964e074025f7d24c6f0c5e35f0fbe52'
 else:
  version='1.6.0';archive_env='COOKERY_160_ARCHIVE';file_path='9054/164'
  assert spec['host_uuid']=='5df753c9-3436-4fba-87f1-a2da3651cfcf' and spec['version']==([0,2,10] if tuple(json.loads((ROOT/'baseline.json').read_text())['version'])>=(2,8,123) else [0,2,9] if tuple(json.loads((ROOT/'baseline.json').read_text())['version'])>=(2,8,122) else [0,2,8] if tuple(json.loads((ROOT/'baseline.json').read_text())['version'])>=(2,8,121) else [0,2,7] if tuple(json.loads((ROOT/'baseline.json').read_text())['version'])>=(2,8,120) else [0,2,6] if tuple(json.loads((ROOT/'baseline.json').read_text())['version'])>=(2,8,74) else [0,2,5])
  assert spec['archive_sha256']=='da12fe6d39d7514aff1de3c963d69899324d771be5ca0fc3da1ccb759c7ad458'
 with tempfile.TemporaryDirectory() as tmp:
  base=Path(tmp);archive=Path(os.environ[archive_env]) if os.environ.get(archive_env) else base/'author.mcaddon'
  if not archive.exists():
   with urllib.request.urlopen('https://edge.forgecdn.net/files/'+file_path+'/Kaleidoscope%20Cookery%20v'+version+'.mcaddon',timeout=60) as response:archive.write_bytes(response.read())
  assert hashlib.sha256(archive.read_bytes()).hexdigest()==spec['archive_sha256']
  with zipfile.ZipFile(archive) as z:
   prefix='Kaleidoscope Cookery v'+version+' [BP]/'
   originals={name:z.read(prefix+name) for name in spec['original_files']}
   original_oil_registry=z.read(prefix+'scripts/api/oilContainers.js')
  for name,raw in originals.items():
   assert hashlib.sha256(raw).hexdigest()==spec['original_files'][name],name
   text=spec['imports'].get(name,'')+raw.decode()
   if name.endswith('.json'):
    data=json.loads(text)
    for op in spec['json_updates']:
     if op['path']==name:
      assert op['pointer']==['minecraft:item','components','minecraft:allow_off_hand'] and op['value'] is True
      assert 'minecraft:allow_off_hand' not in data['minecraft:item']['components'];data['minecraft:item']['components']['minecraft:allow_off_hand']=True
    text=json.dumps(data,ensure_ascii=False,indent=2)+'\n'
   for op in spec['insertions']:
    if op['path']==name:
     assert text.count(op['anchor'])==1; text=text.replace(op['anchor'],op['text']+op['anchor'] if op['position']=='before' else op['anchor']+op['text'])
   assert hashlib.sha256(text.encode()).hexdigest()==spec['patched_files'][name],name
   if name=='scripts/api/guidebookExtensionRegistry.js':check_guide_locale_registry(raw.decode(),text,base,author_fixed=author161)
   if name.endswith('.js'):
    p=base/(Path(name).stem+'.mjs');p.write_text(text);subprocess.run(['node','--check',str(p)],check=True)
   if name.endswith('/oilPot.js'):
    start=text.index('export function consumeOilFromHeldContainer(player){')
    body=text[start:].split('// Backward-compatible private alias',1)[0]
    # Actual adapted author function + actual generic author registry; no owned
    # registry substitute and no in-game/simulated player acceptance claimed.
    registry=original_oil_registry.decode().replace('import { EquipmentSlot, GameMode, ItemStack } from "@minecraft/server";','')
    fixture="""import assert from 'node:assert/strict';
const EquipmentSlot={Mainhand:'Mainhand'},GameMode={Creative:'Creative'},FILLED_POT='kaleidoscope_cookery:oil_pot_filled';
class ItemStack {constructor(typeId,amount){this.typeId=typeId;this.amount=amount;this.data={}}getDynamicProperty(k){return this.data[k]}setDynamicProperty(k,v){this.data[k]=v}}
let sharedCalls=0;const consumeSharedOilFromHeldPot=()=>{sharedCalls++;return true};const slot=p=>p.getComponent('minecraft:equippable').getEquipmentSlot('Mainhand');
"""+registry+'\n'+body+"""
const hand={item:new ItemStack('external:oil_can',1),hasItem(){return !!this.item},getItem(){return this.item},setItem(i){this.item=i}};
const owner={getComponent:()=>({getEquipmentSlot:()=>hand}),getGameMode:()=> 'Survival'};
assert.equal(registerOilContainer({api:1,source:'external',container:{id:'external:oil_can',empty:'external:empty_can',oil:'external:oil',capacity:3,defaultAmount:3,amountProperty:'external:amount'}}).ok,true);
for(const expected of [2,1]){assert.equal(consumeOilFromHeldContainer(owner),true);assert.equal(hand.item.typeId,'external:oil_can');assert.equal(readRegisteredOilAmount(hand.item),expected)}
assert.equal(consumeOilFromHeldContainer(owner),true);assert.equal(hand.item.typeId,'external:empty_can');assert.equal(sharedCalls,0);
hand.item=new ItemStack(FILLED_POT,1);assert.equal(consumeOilFromHeldContainer(owner),true);assert.equal(sharedCalls,1);
console.log('Cookery 1.6.0 original foreign container route/debit/empty remainder and shared author can dispatch PASS');
"""
    p=base/'foreign-oil.mjs';p.write_text(fixture.replace('Cookery 1.6.0 original foreign','Cookery '+version+' original foreign'));subprocess.run(['node',str(p)],check=True)
  check_tavern_guide_bridge()
  print('All reviewed '+version+' targets, syntax and scoped oil/guide adapters PASS; native/client gates remain separate')
if __name__=='__main__':check()
