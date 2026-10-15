from __future__ import annotations
from pathlib import Path
import argparse,hashlib,json,subprocess
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
P=ROOT/'projects/grilling/gameplay_core';BP=P/'behavior_pack';RP=P/'resource_pack'
TEX_SHA='cc8bda808a99d38ecdae90a78a3acf6b7c0dea9a'

def load(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def blob(path):
 v=path.read_bytes();return hashlib.sha1(b'blob '+str(len(v)).encode()+bytes([0])+v).hexdigest()

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--compiled',action='store_true');a=ap.parse_args()
 for p in P.rglob('*.json'):load(p)
 bm,rm=load(BP/'manifest.json'),load(RP/'manifest.json')
 assert bm['header']['version']==[2,7,20] and rm['header']['version']==[2,7,20]
 assert bm['header']['name']=='Kaleidoscope Grilling A2.7.20 Roasted Sweet Potato BP'
 assert rm['header']['name']=='Kaleidoscope Grilling A2.7.20 Roasted Sweet Potato RP'

 item=load(BP/'items/roasted_sweet_potato.json')['minecraft:item'];c=item['components']
 assert item['description']['identifier']=='kaleidoscope_grilling:roasted_sweet_potato'
 assert c['minecraft:max_stack_size']==64 and c['minecraft:allow_off_hand'] is True
 assert c['minecraft:food']=={'can_always_eat':False,'nutrition':6,'saturation_modifier':0.2}
 assert c['minecraft:use_animation']=={'value':'eat'}
 assert c['minecraft:use_modifiers']['start_using']=='always'
 assert c['minecraft:tags']['tags']==['minecraft:is_food']

 tex=RP/'textures/items/roasted_sweet_potato.png';assert tex.is_file() and blob(tex)==TEX_SHA
 with Image.open(tex) as im:assert im.size==(16,16)
 assert load(RP/'textures/item_texture.json')['texture_data']['roasted_sweet_potato']['textures']=='textures/items/roasted_sweet_potato'

 recipe=load(BP/'recipes/roasted_sweet_potato.json')['minecraft:recipe_furnace']
 assert recipe['description']['identifier']=='kaleidoscope_grilling:roasted_sweet_potato'
 assert recipe['tags']==['furnace','smoker','campfire','soul_campfire']
 assert recipe['input']=='kaleidoscope_grilling:sweet_potato'
 assert recipe['output']=='kaleidoscope_grilling:roasted_sweet_potato'
 assert 'experience' not in recipe and 'cookingtime' not in recipe

 core=(BP/'scripts/a2720_roasted_sweet_potato_core.js').read_text(encoding='utf-8')
 runtime=(BP/'scripts/a2720_roasted_sweet_potato_runtime.js').read_text(encoding='utf-8')
 for token in ("WARMTH_EFFECT='warmth'","WARMTH_TICKS=600",'NUTRITION=6','SATURATION_MODIFIER=0.2'):assert token in core,token
 for token in ('world.afterEvents.itemCompleteUse.subscribe','FX_KEY=','nextWarmthUntil','applyRoastedSweetPotatoWarmth'):assert token in runtime,token
 assert 'FOOD_DATA' not in runtime and 'playAnimation' not in runtime

 main=(BP/'scripts/main.js').read_text(encoding='utf-8')
 assert "import './a2719_sweet_potato_crop_runtime.js';" in main
 assert "import './a2720_roasted_sweet_potato_runtime.js';" in main
 assert "const HOT_UNTIL_KEY='kaleidoscope_grilling:hot_until',FX_KEY='kaleidoscope_grilling:a21_fx';" in main
 assert "if(system.currentTick%20===0&&fx.warmth)" in main

 subprocess.run(['node',str(ROOT/'development/gameplay_core/test_a2720_core.mjs')],check=True)
 subprocess.run(['node','--experimental-vm-modules',str(ROOT/'development/gameplay_core/test_a2720_runtime.mjs')],check=True)
 subprocess.run(['node',str(ROOT/'development/gameplay_core/test_a2719_core.mjs')],check=True)
 subprocess.run(['node','--experimental-vm-modules',str(ROOT/'development/gameplay_core/test_a2719_runtime.mjs')],check=True)
 for p in (BP/'scripts').glob('*.js'):subprocess.run(['node','--check',str(p)],check=True)

 report=load(P/'reports/a2720-parity.json')
 assert report['version']=='A2.7.20'
 assert report['item']['nutrition']==6 and report['item']['saturation_modifier']==0.2
 assert report['item']['base_effect_ticks']==600
 assert report['recipes']['station_access_parity'] is True
 assert report['recipes']['bedrock_station_tags']==['furnace','smoker','campfire','soul_campfire']
 assert report['recipes']['explicit_cookingtime_field_available'] is False
 assert report['recipes']['explicit_experience_field_available'] is False
 assert report['recipes']['java_experience_0_35_exact'] is False
 assert report['effect']['native_food_consumption_preserved'] is True
 assert report['effect']['existing_a21_fx_warmth_state_reused'] is True
 assert report['effect']['cuisine_quality_duration_scaling_ported'] is False
 assert report['survival_chain']['roasted_sweet_potato_obtainable_in_survival'] is True
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
  'version':'A2.7.20','roasted_sweet_potato_item':True,'native_cooking_recipe':True,
  'station_tags':['furnace','smoker','campfire','soul_campfire'],'warmth_base_ticks':600,
  'native_food_consumption':True,'java_experience_0_35_exact':False,'cuisine_quality_scaling_ported':False,
  'a2719_sweet_potato_crop_preserved':True,'compiled':a.compiled,'compiled_packs':compiled,
  'minecraft_tested':False,'bds_tested':False
 }
 out=P/'reports'/('a2720-dash-verification.json' if a.compiled else 'a2720-structure-verification.json')
 out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(out.read_text(encoding='utf-8'))

if __name__=='__main__':main()
