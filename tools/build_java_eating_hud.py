#!/usr/bin/env python3
"""Copy pinned Java GUI assets and emit a graphical eating HUD (no text bar)."""
from pathlib import Path
import argparse,hashlib,json,zipfile
from actionbar_hud_ui import install_actionbar_factory
from hud_mount_contract import global_catalog
from java_eating_hud_atlas import ATLAS_REL,build_progress_atlas,atlas_metadata
ROOT=Path(__file__).resolve().parents[1]
RP=ROOT/'projects/grilling/gameplay_core/resource_pack'
BP=ROOT/'projects/grilling/gameplay_core/behavior_pack'
PREFIX='KG_HUD!'
def code(n):return f'{n:02x}'
def contains(fragment):return f"(not (($kg_text - '{fragment}') = $kg_text))"
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--jar',type=Path,required=True);a=ap.parse_args()
 assert hashlib.sha256(a.jar.read_bytes()).hexdigest()=='cf31071e4ba790bcd5c1d3f6005439bc512acba084e70b8ab6a767e8c8f99dd6'
 assets={};icons=[]
 with zipfile.ZipFile(a.jar) as z:
  names=[n for n in z.namelist() if n.endswith('.png') and ('/textures/item/fixed_skewer_gui_16/' in n or '/textures/gui/skewer_eating_' in n)]
  for name in sorted(names):
   rel='textures/ui/kg_java/'+name.split('/')[-1];data=z.read(name);p=RP/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
   assets[rel]={'java_path':name,'sha256':hashlib.sha256(data).hexdigest()}
   if '/fixed_skewer_gui_16/' in name:icons.append(p.stem)
 atlas=build_progress_atlas((RP/'textures/ui/kg_java/skewer_eating_progress_yellow.png').read_bytes(),(RP/'textures/ui/kg_java/skewer_eating_progress_green.png').read_bytes())
 (RP/ATLAS_REL).write_bytes(atlas)
 derived_assets={ATLAS_REL:atlas_metadata(atlas)}
 icon_index={name:i for i,name in enumerate(icons)}
 (BP/'scripts/java_eating_hud_data.js').write_text('// Pinned original Java 1.1.1 eating HUD icons.\nexport const JAVA_EATING_ICONS=Object.freeze('+json.dumps(icon_index,sort_keys=True)+');\n')
 controls=[]
 base={'type':'image','size':[102,5],'texture':'textures/ui/kg_java/skewer_eating_base','bilinear':False,'anchor_from':'bottom_middle','anchor_to':'bottom_middle','offset':[50,-49]}
 # Keep the outer packet/expiry alive, but omit the images for other actionbars.
 base['ignored']=f"(not (not (($kg_text - '{PREFIX}') = $kg_text) and (($kg_text - '{PREFIX}END;') = $kg_text)))"
 controls.append({'base':base})
 for ready in [False,True]:
  for width in range(1,103):
   image={**base,'size':[width,5],'uv':[102 if ready else 0,0],'uv_size':[width,5],'texture':ATLAS_REL.removesuffix('.png'),'anchor_from':'bottom_middle','anchor_to':'bottom_left','offset':[-1,-49], 'visible':contains(PREFIX+'F:'+code(width)+str(int(ready)))}
   image['ignored']=f"({base['ignored']} or (not {image['visible']}))"
   controls.append({f'fill_{int(ready)}_{width}':image})
 for duration in [90,100]:
  x=-1+int(2550/duration+.5)-8
  for ready in [False,True]:
   for name,index in [*icon_index.items(),('fallback',255)]:
    image={'type':'image','size':[16,16],'bilinear':False,'anchor_from':'bottom_middle','anchor_to':'bottom_left','offset':[x,-43], 'texture':'textures/ui/kg_java/'+(name if name!='fallback' else 'skewer_eating_ready_fallback' if ready else 'skewer_eating_pending'),'visible':contains('I:'+code(duration)+code(index)+str(int(ready))+';')}
    image['ignored']=f"({base['ignored']} or (not {image['visible']}))"
    if not ready and name!='fallback':image.update({'color':[.36,.36,.36],'alpha':.86})
    controls.append({f'icon_{duration}_{int(ready)}_{index}':image})
 ui={'namespace':'kaleidoscope_grilling_hud',
 'kg_eating_packet':{'type':'panel','size':['100%','100%'],
  # Mojang ui_common.json at pinned 46ba6ea uses requires:$touch for native touch layout.
  # Lift the owned panel clear of Use Item; desktop retains the Java offsets.
  '$kg_hud_offset|default':[0,0],
  'variables':[{'requires':'$touch','$kg_hud_offset':[0,-26]}],
  'offset':'$kg_hud_offset','controls':controls},
 'root':{'type':'panel','size':['100%','100%'],'controls':[{'kg_java_eating@kaleidoscope_grilling_hud.kg_eating_packet':{}}]}}
 install_actionbar_factory(ui,'grilling','kg_text',PREFIX,PREFIX+'END;',.2)
 # Shared native hud_screen mount stays byte-identical to Tavern. Keep every
 # Grilling-owned definition in its independently registered catalog file.
 p=RP/'ui/kg_grilling_hud.json';p.parent.mkdir(exist_ok=True);p.write_text(json.dumps(ui,ensure_ascii=False,indent=2)+'\n')
 (p.parent/'_ui_defs.json').write_text(json.dumps({'ui_defs':['ui/kg_grilling_hud.json']},indent=2)+'\n')
 (p.parent/'_global_variables.json').write_text(json.dumps(global_catalog('grilling'),indent=2)+'\n')
 (ROOT/'development/gameplay_core/fixtures/java-hud-1.1.1.json').write_text(json.dumps({'jar_sha256':hashlib.sha256(a.jar.read_bytes()).hexdigest(),'assets':assets,'source_classes':['skewer.SkewerEatingHud','skewer.SkewerGuiIconCache'],'bar':{'width':102,'height':5,'left_from_center':-1,'top_from_bottom':-54,'ready_ticks':25,'pending_rgb':[.36,.36,.36],'pending_alpha':.86},'machine_hud_default':False,'derived_assets':derived_assets},indent=2)+'\n')
 print('Pinned original HUD textures:',len(assets),'controls:',len(controls))
if __name__=='__main__':main()
