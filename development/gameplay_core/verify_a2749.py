from __future__ import annotations
from pathlib import Path
import argparse,hashlib,json,subprocess

ROOT=Path(__file__).resolve().parents[2];P=ROOT/'projects/grilling/gameplay_core';BP=P/'behavior_pack';RP=P/'resource_pack';DEV=Path(__file__).parent
TEX={'sugared_tomato':'da58483560e98eaeb3abc24973f0c1b247931c65','pepper_honey':'0a629329dce3bd29c7d56baa5d2ebbf5693d6f6a'}
IDS=('kaleidoscope_grilling:sugared_tomato','kaleidoscope_grilling:pepper_honey')
LANG_KEYS=(
 'item.kaleidoscope_grilling:sugared_tomato.name','tooltip.kaleidoscope_grilling.sugared_tomato.maxim',
 'item.kaleidoscope_grilling:pepper_honey.name','tooltip.kaleidoscope_grilling.pepper_honey.maxim',
)
def load(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def blob(path):
 v=path.read_bytes();return hashlib.sha1(b'blob '+str(len(v)).encode()+bytes([0])+v).hexdigest()
def png_size(path):
 v=path.read_bytes()
 assert v[:8]==b'\x89PNG\r\n\x1a\n' and v[12:16]==b'IHDR',path
 return int.from_bytes(v[16:20],'big'),int.from_bytes(v[20:24],'big')

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--compiled',action='store_true');a=ap.parse_args()
 for p in P.rglob('*.json'):load(p)
 bm,rm=load(BP/'manifest.json'),load(RP/'manifest.json')
 assert bm['header']['version']==[2,7,49] and rm['header']['version']==[2,7,49]
 assert bm['header']['name']=='Kaleidoscope Grilling A2.7.49 Sugared Tomato + Pepper Honey BP'
 for name,(nutrition,sat) in {'sugared_tomato':(6,0.65),'pepper_honey':(4,0.25)}.items():
  item=load(BP/f'items/{name}.json')['minecraft:item'];c=item['components']
  assert item['description']['identifier']==f'kaleidoscope_grilling:{name}'
  assert c['minecraft:max_stack_size']==64 and c['minecraft:allow_off_hand'] is True
  assert c['minecraft:food']=={'can_always_eat':False,'nutrition':nutrition,'saturation_modifier':sat}
  assert c['minecraft:use_animation']=={'value':'eat'} and c['minecraft:tags']['tags']==['minecraft:is_food']
  tex=RP/f'textures/items/{name}.png';assert tex.is_file() and blob(tex)==TEX[name]
  assert png_size(tex)==(16,16)
  assert load(RP/'textures/item_texture.json')['texture_data'][name]['textures']==f'textures/items/{name}'

 sug=load(BP/'recipes/sugared_tomato.json')['minecraft:recipe_shapeless']
 assert sug['ingredients']==[{'item':'kaleidoscope_cookery:tomato'},{'item':'minecraft:sugar'}]
 assert sug['result']=={'item':'kaleidoscope_grilling:sugared_tomato','count':1}
 pep=load(BP/'recipes/pepper_honey.json')['minecraft:recipe_shapeless']
 assert pep['ingredients']==[
  {'item':'kaleidoscope_grilling:sichuan_pepper'},{'item':'kaleidoscope_grilling:sichuan_pepper'},
  {'item':'kaleidoscope_grilling:sichuan_pepper'},{'item':'minecraft:honey_bottle'}
 ]
 assert pep['result']=={'item':'kaleidoscope_grilling:pepper_honey','count':1}

 core=BP/'scripts/a2749_sugared_tomato_pepper_honey_core.js'
 assert core.read_bytes()==(DEV/'a2749_sugared_tomato_pepper_honey_core.js').read_bytes()
 effect=(BP/'scripts/a2732_standalone_food_effect_core.js').read_text(encoding='utf-8')
 assert effect.count("from './a2747_wedding_candy_core.js';")==1
 assert effect.count("from './a2749_sugared_tomato_pepper_honey_core.js';")==1
 assert effect.count('pepperHoneyEffectRow()')==1
 assert 'itemId:WEDDING_CANDY_ID' in effect
 runtime=(BP/'scripts/a2732_standalone_food_effect_runtime.js').read_text(encoding='utf-8')
 assert runtime.count('itemCompleteUse.subscribe')==1
 main=(BP/'scripts/main.js').read_text(encoding='utf-8')
 assert main.count("import './a2732_standalone_food_effect_runtime.js';")==1
 assert "!!fx.numb" in main

 catalog=load(BP/'item_catalog/crafting_item_catalog.json')
 rows=catalog['minecraft:crafting_items_catalog']['categories'][0]['groups'][0]['items']
 for item_id in IDS:assert rows.count(item_id)==1,item_id

 for lang in ('en_US.lang','zh_CN.lang','zh_TW.lang'):
  rows=(RP/'texts'/lang).read_text(encoding='utf-8').splitlines()
  for key in LANG_KEYS:assert sum(1 for row in rows if row.startswith(key+'='))==1,(lang,key)

 subprocess.run(['node',str(DEV/'test_a2749_core.mjs')],check=True)
 for p in (BP/'scripts').glob('*.js'):subprocess.run(['node','--check',str(p)],check=True)

 report=load(P/'reports/a2749-sugared-tomato-pepper-honey.json')
 assert report['version']=='A2.7.49'
 assert report['foods']['sugared_tomato']['nutrition']==6
 assert report['foods']['pepper_honey']['effect_ticks']==1200
 assert report['dedupe']['existing_pr_46_source_reused'] is True
 assert report['dedupe']['new_item_complete_use_listener_created'] is False
 assert report['dedupe']['wedding_candy_effect_row_preserved'] is True
 assert report['dedupe']['duplicate_cookery_tomato_created'] is False
 assert report['catalog_registered'] is True
 assert report['minecraft_tested'] is False and report['bds_tested'] is False

 compiled=[]
 if a.compiled:
  dist=P/'builds/dist'
  for name,source in [('behavior_pack',BP),('resource_pack',RP)]:
   manifest=load(source/'manifest.json')
   matches=[x.parent for x in dist.rglob('manifest.json') if load(x).get('header',{}).get('uuid')==manifest['header']['uuid']]
   assert len(matches)==1,(name,matches);target=matches[0];count=0
   for p in source.rglob('*'):
    if not p.is_file() or p.name.startswith('.'):continue
    q=target/p.relative_to(source);assert q.is_file(),str(q)
    if p.suffix=='.json':assert load(p)==load(q),str(q)
    else:assert p.read_bytes()==q.read_bytes(),str(q)
    count+=1
   compiled.append({'pack':name,'compared_files':count,'matches_source':True})

 result={
  'version':'A2.7.49','sugared_tomato':True,'pepper_honey':True,
  'pepper_honey_numb_ticks':1200,'shared_standalone_effect_runtime_reused':True,
  'wedding_candy_preserved':True,'cookery_tomato_host_reused':True,'catalog_registered':True,
  'compiled':a.compiled,'compiled_packs':compiled,'minecraft_tested':False,'bds_tested':False
 }
 out=P/'reports'/('a2749-dash-verification.json' if a.compiled else 'a2749-structure-verification.json')
 out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(out.read_text(encoding='utf-8'))
if __name__=='__main__':main()
