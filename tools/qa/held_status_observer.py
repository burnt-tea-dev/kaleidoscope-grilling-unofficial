#!/usr/bin/env python3
"""Install or remove a read-only observer for reviewed G194, G206 or G208 BP copies."""
from __future__ import annotations
import argparse, hashlib, json, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RELEASE_HISTORY = ROOT / 'release-history.json'
SOURCE = ROOT / 'projects/grilling/gameplay_core/behavior_pack'
RECEIPT_NAME = '.held-status-qa-receipt.json'
BACKUP_NAME = '.held-status-qa-original'
IMPORT = "import {EquipmentSlot,world,system} from '@minecraft/server';\n"
G206_OBSERVER = r'''
// BEGIN kg_held_qa read-only observer
system.afterEvents.scriptEventReceive.subscribe(event=>{
 if(event.id!=='kg_held_qa:status')return;
 const name=String(event.message??'').trim();
 if(!name)return;
 const matches=world.getAllPlayers().filter(player=>player.name===name);
 if(matches.length!==1){console.warn('[kg_held_qa] '+JSON.stringify({kind:'status',requested:name,error:matches.length?'ambiguous player name':'player not online',tick:system.currentTick}));return;}
 const player=matches[0],hands=cache.get(player.id);
 const item=(slot)=>{
  try{
   const stack=player.getComponent('minecraft:equippable')?.getEquipment(slot);
   if(!stack)return null;
   const ids=stack.getDynamicPropertyIds?.()??[];
   const properties={};
   for(const key of ids)properties[key]=stack.getDynamicProperty(key);
   const rawLore=typeof stack.getRawLore==='function'?stack.getRawLore():undefined;
   const lore=typeof stack.getLore==='function'?stack.getLore():undefined;
   return {typeId:stack.typeId,amount:stack.amount,nameTag:stack.nameTag??null,lore:lore??null,rawLore:rawLore??null,rawLoreSupported:rawLore!==undefined,dynamicProperties:properties,dynamicPropertyScope:'all direct properties readable from this ItemStack under the active G pack API; not cross-pack UUID access'};
  }catch(error){return {readError:String(error)};}
 };
 const snapshot=hand=>{const entry=hands?.get(hand);return entry?{kind:entry.kind,words:[...entry.values]}:{kind:'uncached',words:null};};
 console.warn('[kg_held_qa] '+JSON.stringify({kind:'status',profile:'g206-cache24',tick:system.currentTick,player:{name:player.name,id:player.id},frame:player.getProperty(FRAME_PROPERTY),frameSource:'G206 held transport player property',main:{transport:snapshot('main'),item:item(EquipmentSlot.Mainhand)},off:{transport:snapshot('off'),item:item(EquipmentSlot.Offhand)},rendererAcknowledged:false}));
});
// END kg_held_qa read-only observer
'''
LEGACY_PROPERTIES = (
 'kaleidoscope_grilling:eat_profile','kaleidoscope_grilling:eat_hand',
 'kaleidoscope_grilling:eat_projection','kaleidoscope_grilling:eat_native_ticks',
 'kaleidoscope_grilling:eat_elapsed_ticks',
 *(f'kaleidoscope_grilling:secret_{hand}_{suffix}' for hand in ('main','off') for suffix in ('0','1','2','piece')),
 *(f'kaleidoscope_grilling:bottle_{hand}_{index}' for hand in ('main','off') for index in range(8)),
 'kaleidoscope_grilling:season_hand','kaleidoscope_grilling:season_phase','kaleidoscope_grilling:pending_hand',
)
G194_OBSERVER = '''
// BEGIN kg_held_qa read-only legacy native-property observer
system.afterEvents.scriptEventReceive.subscribe(event=>{
 if(event.id!=='kg_held_qa:status')return;
 const name=String(event.message??'').trim();
 if(!name)return;
 const matches=world.getAllPlayers().filter(player=>player.name===name);
 if(matches.length!==1){console.warn('[kg_held_qa] '+JSON.stringify({kind:'status',profile:'g194-native32',requested:name,error:matches.length?'ambiguous player name':'player not online',tick:system.currentTick}));return;}
 const player=matches[0];
 const nativeProperties=Object.fromEntries(LEGACY_PROPERTIES.map(key=>[key,player.getProperty(key)]));
 const item=(slot)=>{
  try{
   const stack=player.getComponent('minecraft:equippable')?.getEquipment(slot);
   if(!stack)return null;
   const properties={};for(const key of stack.getDynamicPropertyIds?.()??[])properties[key]=stack.getDynamicProperty(key);
   const rawLore=typeof stack.getRawLore==='function'?stack.getRawLore():undefined;
   const lore=typeof stack.getLore==='function'?stack.getLore():undefined;
   return {typeId:stack.typeId,amount:stack.amount,nameTag:stack.nameTag??null,lore:lore??null,rawLore:rawLore??null,rawLoreSupported:rawLore!==undefined,dynamicProperties:properties,dynamicPropertyScope:'all direct properties readable from this ItemStack under the active G pack API; not cross-pack UUID access'};
  }catch(error){return {readError:String(error)};}
 };
 console.warn('[kg_held_qa] '+JSON.stringify({kind:'status',profile:'g194-native32',tick:system.currentTick,player:{name:player.name,id:player.id},frame:null,frameSource:null,transport:{source:'legacy native player properties; no held snapshot cache',words:null},nativeProperties,propertySource:'one player.getProperty(key) call for each of the 32 keys declared in the matched G194 entities/player.json',main:{item:item(EquipmentSlot.Mainhand)},off:{item:item(EquipmentSlot.Offhand)},rendererAcknowledged:false}));
});
// END kg_held_qa read-only legacy native-property observer
'''
G194_FINGERPRINT = {'sha256':'f2b79963d8ca7203255677a6770eead26eaf355b8511953e0f3c8f5115e47e0a','files':787}
G194_MANIFEST_SHA256 = 'db5cf2c6b0ff5911341f0dcc76551dd589bd35e8f26b02f19779fdfac0fbc82c'
G194_PROFILE = {'id':'g194-native32','version':[2,8,194],'fingerprint':G194_FINGERPRINT,
 'manifest_sha256':G194_MANIFEST_SHA256,'uuid':'c68005c5-23ff-54e8-a3ff-da6349ad43c2',
 'files':['scripts/main.js'],'source_file':'scripts/main.js','observer':G194_OBSERVER,
 'properties':LEGACY_PROPERTIES}

def fail(message: str) -> None:
    raise SystemExit('held-status: ' + message)

def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def fingerprint(root: Path) -> dict:
    rows={}
    for p in sorted(root.rglob('*')):
        if p.is_symlink(): fail('pack copy contains symlink: '+str(p))
        if p.is_file(): rows[p.relative_to(root).as_posix()]=sha(p)
    digest=hashlib.sha256(json.dumps(rows,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    return {'sha256':digest,'files':len(rows)}

def safe_pack(arg: str, live_roots: list[str]) -> Path:
    path=Path(arg).resolve()
    for root_arg in live_roots:
        root=Path(root_arg).resolve()
        try: path.relative_to(root)
        except ValueError: continue
        fail('target is inside a caller-declared live root')
    if not path.is_dir(): fail('target must be an existing isolated BP directory copy')
    try: path.relative_to(SOURCE.resolve())
    except ValueError: pass
    else: fail('canonical source tree is forbidden')
    return path

def select_profile(pack: Path) -> dict:
    history=json.loads(RELEASE_HISTORY.read_text())
    current_version=[2,8,206]
    current={'sha256': '7645665bac9ae1fa292f3589a6f69591be51dcc4fd0a46a60c5dfd58cc606a74', 'files': 788}
    if history.get('2.8.206',{}).get('BP')!=current:
        fail('G206 profile hash does not match release-history.json')
    actual=fingerprint(pack)
    if actual==current:
        manifest=pack/'manifest.json'
        if not manifest.is_file() or sha(manifest)!='2b812f54133b307a05bda55597f623862314c9b3c68a703ee25ab11885c92c06':
            fail('G206 manifest bytes do not match the reviewed release profile')
        return {'id':'g206-cache24','version':current_version,'fingerprint':current,
                'files':['scripts/held_visual_transport.js'],'source_file':'scripts/held_visual_transport.js',
                'observer':G206_OBSERVER,'properties':()}
    renewed={'sha256':'b96dc3b5dec346a85750fc77c74da079136296de92f2a6c7c876a7a0f4f79ae5','files':793}
    if history.get('2.8.208',{}).get('BP')!=renewed:
        fail('G208 profile hash does not match release-history.json')
    if actual==renewed:
        if sha(pack/'manifest.json')!='689e127f464b24956814f4bc409b6ef08f3081683a2b75b6f6bbec0d88ba609d':
            fail('G208 manifest bytes do not match the reviewed release profile')
        return {'id':'g208-cache24','version':[2,8,208],'fingerprint':renewed,
                'files':['scripts/held_visual_transport.js'],'source_file':'scripts/held_visual_transport.js',
                'observer':G206_OBSERVER.replace('g206-cache24','g208-cache24').replace('G206 held','G208 held'),'properties':()}
    legacy_version='2.8.194';legacy=G194_PROFILE
    if history.get(legacy_version,{}).get('BP')!=legacy['fingerprint']:
        fail('G194 profile hash does not match release-history.json')
    if actual==legacy['fingerprint']:
        manifest=pack/'manifest.json'
        if not manifest.is_file() or sha(manifest)!=legacy['manifest_sha256']:
            fail('G194 manifest bytes do not match the reviewed release profile')
        data=json.loads(manifest.read_text())
        if data.get('header',{}).get('uuid')!=legacy['uuid'] or data.get('header',{}).get('version')!=legacy['version']:
            fail('G194 BP manifest identity mismatch')
        schema_path=pack/'entities/player.json'
        schema=json.loads(schema_path.read_text())['minecraft:entity']['description']['properties']
        if tuple(schema.keys())!=legacy['properties'] or len(schema)!=32:
            fail('G194 native player property schema differs from the reviewed 32-property profile')
        return legacy
    fail('unknown BP: complete bytes must match the reviewed G194, G206 or G208 release profile')

def install(pack: Path) -> None:
    profile=select_profile(pack)
    receipt=pack.parent/RECEIPT_NAME;backup=pack.parent/BACKUP_NAME
    if receipt.exists() or backup.exists(): fail('existing observer receipt or backup; refusing overwrite')
    source_file=SOURCE/'scripts/held_visual_transport.js'
    if profile['id'] in ('g206-cache24','g208-cache24'):
        target_file=pack/profile['source_file']
        if not target_file.is_file() or sha(target_file)!=sha(source_file): fail('held_visual_transport.js differs from the reviewed cache transport')
        additions={profile['source_file']:IMPORT+target_file.read_text(encoding='utf-8')+'\n'+profile['observer']}
    else:
        target_file=pack/profile['source_file']
        original=target_file.read_text(encoding='utf-8')
        if not original.startswith('// Compose feature owners;'):
            fail('G194 main.js does not match its reviewed assembly entry')
        property_json=json.dumps(profile['properties'],separators=(',',':'))
        observer=profile['observer'].replace('LEGACY_PROPERTIES',property_json)
        additions={profile['source_file']:IMPORT+original+'\n'+observer}
    backup.mkdir()
    originals={}
    for relative,content in additions.items():
        target=pack/relative;dest=backup/relative;dest.parent.mkdir(parents=True,exist_ok=True)
        originals[relative]=sha(target);shutil.copy2(target,dest)
        target.write_text(content,encoding='utf-8')
    payload={'schema':2,'profile':profile['id'],'mode':'read-only isolated QA instrumentation','baseline':profile['fingerprint'],
      'files':{relative:{'original_sha256':originals[relative],'instrumented_sha256':sha(pack/relative)} for relative in profile['files']},
      'bds_stopped':'caller_assertion_only; verify independently with assert_quiet','target':str(pack),
      'backup':str(backup)}
    receipt.write_text(json.dumps(payload,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'installed':True,'profile':profile['id'],'receipt':str(receipt),'observer':'kg_held_qa:status',
      'bds_stopped':'caller_assertion_only; verify independently with assert_quiet'},indent=2))

def restore(pack: Path) -> None:
    receipt=pack.parent/RECEIPT_NAME;backup=pack.parent/BACKUP_NAME
    if not receipt.is_file() or not backup.is_dir(): fail('matching receipt and original backup are required')
    info=json.loads(receipt.read_text())
    if info.get('schema')!=2 or Path(info.get('target','')).resolve()!=pack: fail('receipt schema or target mismatch')
    profile_id=info.get('profile')
    if profile_id not in ('g194-native32','g206-cache24','g208-cache24'): fail('receipt profile is not reviewed')
    required_files=['scripts/main.js'] if profile_id=='g194-native32' else ['scripts/held_visual_transport.js']
    files=info.get('files',{})
    if set(files)!=set(required_files): fail('receipt file list does not match reviewed profile')
    for relative in required_files:
        target=pack/relative;saved=backup/relative
        record=files[relative]
        if not saved.is_file() or sha(saved)!=record['original_sha256']: fail('backup hash mismatch: '+relative)
        if not target.is_file() or sha(target)!=record['instrumented_sha256']: fail('instrumented file changed; preserving it and refusing restore')
    for relative in required_files: shutil.copy2(backup/relative,pack/relative)
    if any(sha(pack/relative)!=files[relative]['original_sha256'] for relative in required_files): fail('restored source-file hash mismatch')
    actual=fingerprint(pack);full=actual==info['baseline']
    receipt.unlink();shutil.rmtree(backup)
    print(json.dumps({'instrumentation_restored':True,'g206_transport_restored':profile_id=='g206-cache24','g208_transport_restored':profile_id=='g208-cache24','restored_files':required_files,'target':str(pack),
      'full_baseline_restored':full,'baseline_expected':info['baseline'],'baseline_actual':actual,
      'other_files_preserved':not full},indent=2))

def main() -> None:
    parser=argparse.ArgumentParser()
    parser.add_argument('operation',choices=['install','restore'])
    parser.add_argument('--pack',required=True,help='isolated BP copy matching the full reviewed G194, G206 or G208 release profile')
    parser.add_argument('--bds-stopped',action='store_true',help='caller assertion only; verify independently with assert_quiet')
    parser.add_argument('--live-root',action='append',required=True,help='caller-declared live root; repeat for host/container aliases')
    args=parser.parse_args()
    if not args.bds_stopped: fail('stop the isolated BDS and pass --bds-stopped; verify independently with assert_quiet')
    pack=safe_pack(args.pack,args.live_root)
    if args.operation=='install': install(pack)
    else: restore(pack)

if __name__=='__main__': main()
