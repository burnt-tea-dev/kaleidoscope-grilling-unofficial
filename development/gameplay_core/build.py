from __future__ import annotations
import argparse, hashlib, json, re, shutil, urllib.request, uuid
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'projects/grilling'
OUT=SRC/'gameplay_core'
UPSTREAM='https://raw.githubusercontent.com/breezeth-CN/KaleidoscopeGrilling/9a1acdab27698457bec16c9362678e574895a28c/'
COOKERY_BP='10f37ae2-9ccf-435f-b34b-0eec8191cd94'
COOKERY_RP='c89dc8df-c3fc-4bc8-8bd0-527abba76681'
COOKERY_VER=[1,0,6]
VERSION=[2,0,0]
NS='kaleidoscope_grilling'
UUID_NS=uuid.UUID('f6bb5adc-7a9e-4f21-9eb0-7d52ee11db20')
EXPECTED={
 'forge-1.20.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java':'a359de5425e3008e728e4790b7bd1b0fe92fbabf',
 'common/src/main/resources/data/kaleidoscope_grilling/grilling/skewers.json':'2628e39468ffd8dbe1b2801051b10d0453d2b216',
 'common/src/main/resources/assets/kaleidoscope_grilling/lang/zh_cn.json':'bbc7465f6bf6ab0c698729e9800fbc3c03ae56db',
 'common/src/main/resources/assets/kaleidoscope_grilling/lang/en_us.json':'807c7f40618d409ca17ccb4c0a39e211a84a7b18',
}

def legacy_output(argv=None):
    parser=argparse.ArgumentParser(
        description='Historical A2.0 reconstruction only. Use package_current.py for the maintained release.'
    )
    parser.add_argument('--legacy-output',type=Path,required=True,
                        help='new absolute directory outside every Git checkout; never release input')
    requested=parser.parse_args(argv).legacy_output.expanduser()
    if not requested.is_absolute():
        parser.error('--legacy-output must be an absolute path')
    output=requested.resolve()
    if requested.is_symlink() or output.exists():
        parser.error('--legacy-output must be a new directory; existing paths are never replaced')
    for parent in (output,*output.parents):
        if (parent/'.git').exists():
            parser.error('--legacy-output cannot be inside a Git checkout or worktree')
    return output

def blob(v:bytes)->str:
    return hashlib.sha1(b'blob '+str(len(v)).encode()+b'\0'+v).hexdigest()

def fetch(path):
    req=urllib.request.Request(UPSTREAM+path,headers={'User-Agent':'Grilling-A2-Core/1'})
    with urllib.request.urlopen(req,timeout=90) as r:
        v=r.read()
    if blob(v)!=EXPECTED[path]:
        raise RuntimeError('pinned source mismatch: '+path)
    return v

def write(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    if isinstance(data,(dict,list)):
        path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    else:
        path.write_text(data,encoding='utf-8')

def profile_for(item_id):
    name=item_id.replace('raw_','').replace('grilled_','')
    if name in ('fish_skewer','caterpillar_skewer'):
        return 'ONE'
    if name in ('bun_slice_skewer','fried_egg_skewer','slime_skewer','sweet_potato_sheet_skewer'):
        return 'TWO'
    if name in ('beef_skewer','chicken_skin_skewer','pork_belly_skewer'):
        return 'FOUR'
    if name=='ender_pearl_skewer':
        return 'THREE'
    return 'THREE_RANDOM'

def parse_food(java):
    data={}
    nausea={}
    for m in re.finditer(r'\brawSkewer\(\s*"([^"]+)"\s*,\s*(\d+)\s*,\s*([0-9.]+)F\s*,\s*(true|false)\s*\)',java,re.S):
        i,n,s,b=m.groups()
        data[i]={'nutrition':int(n),'saturation':float(s),'profile':profile_for(i)}
        nausea[i]=b=='true'
    for m in re.finditer(r'\banimatedRawSkewer\(\s*"([^"]+)"\s*,\s*(\d+)\s*,\s*([0-9.]+)F\s*,\s*(true|false)\s*,\s*MultiBiteSkewerItem\.AnimationProfile\.([A-Z_]+)\s*\)',java,re.S):
        i,n,s,b,p=m.groups()
        data[i]={'nutrition':int(n),'saturation':float(s),'profile':p}
        nausea[i]=b=='true'
    for m in re.finditer(r'\bskewer\(\s*"([^"]+)"\s*,\s*(\d+)\s*,\s*([0-9.]+)F\s*,.*?,\s*(\d+)\s*\)',java,re.S):
        i,n,s,_=m.groups()
        if i.startswith('grilled_'):
            data[i]={'nutrition':int(n),'saturation':float(s),'profile':profile_for(i)}
    for m in re.finditer(r'\bmultiBiteSkewer\(\s*"([^"]+)"\s*,\s*(\d+)\s*,\s*([0-9.]+)F\s*,.*?,\s*(\d+)\s*,\s*MultiBiteSkewerItem\.AnimationProfile\.([A-Z_]+)\s*\)',java,re.S):
        i,n,s,_,p=m.groups()
        data[i]={'nutrition':int(n),'saturation':float(s),'profile':p}
    special={
      'raw_lamb_skewer':(4,.8,'THREE_RANDOM'),
      'grilled_lamb_skewer':(8,.8,'THREE_RANDOM'),
      'raw_golden_skewer':(6,1.2,'THREE_RANDOM'),
      'grilled_golden_skewer':(12,1.2,'THREE_RANDOM'),
      'ordinary_skewer':(5,.46,'THREE_RANDOM'),
      'mysterious_skewer':(2,0,'THREE_RANDOM'),
      'dark_grilling':(1,0,'THREE_RANDOM')
    }
    for i,(n,s,p) in special.items():
        data[i]={'nutrition':n,'saturation':s,'profile':p}
    return data,nausea

def source_icon(item_id):
    if item_id=='ordinary_skewer':
        return 'ordinary_skewer.png'
    base=re.sub(r'^(raw_|grilled_)','',item_id).removesuffix('_skewer')
    if base=='slime':
        return 'slime_skewer.png'
    if item_id.startswith('raw_potato_slice'):
        return 'potato_slice_skewer_raw_1.png'
    suffix='raw' if item_id.startswith('raw_') else 'cooked'
    return f'{base}_skewer_{suffix}.png'

def main(argv=None):
    # Refuse the old default before reading source metadata, fetching or writing.
    global OUT
    OUT=legacy_output(argv)
    guard=json.loads((ROOT/'.repo-target.json').read_text())
    if guard['repository']!='burnt-tea-dev/kaleidoscope-grilling-unofficial' or guard['repository_id']!=1377218440 or guard.get('logical_runtime_repository')!='casama233/kaleidoscope-grilling-unofficial' or guard.get('owner')!={'login':'burnt-tea-dev','id':344456559,'type':'Organization'} or guard.get('private') is not False:
        raise RuntimeError('wrong repository')
    # Reserve the explicitly isolated output once; no historical rebuild deletes it.
    OUT.mkdir(parents=True,exist_ok=False)
    raw={p:fetch(p) for p in EXPECTED}
    java=raw[next(p for p in raw if p.endswith('ModItems.java'))].decode()
    skewers=json.loads(raw[next(p for p in raw if p.endswith('skewers.json'))])
    zh=json.loads(raw[next(p for p in raw if p.endswith('zh_cn.json'))])
    en=json.loads(raw[next(p for p in raw if p.endswith('en_us.json'))])
    food,nausea=parse_food(java)
    recipes=[x for x in skewers['skewers'] if x.get('cooked_result')]
    if len(recipes)!=19:
        raise RuntimeError(f'expected 19 cookable fixed skewers, got {len(recipes)}')
    raw_to_cooked={x['id']:x['cooked_result'] for x in recipes}
    cooked_effects={x['id']:{'effect':x.get('effect',''),'seconds':x.get('effect_seconds',0)} for x in skewers['skewers'] if x['id'].startswith(f'{NS}:grilled_')}
    required={x.split(':',1)[1] for x in raw_to_cooked}
    required|={x.split(':',1)[1] for x in raw_to_cooked.values()}
    required|={'ordinary_skewer','mysterious_skewer','dark_grilling'}
    missing=sorted(required-set(food))
    if missing:
        raise RuntimeError('food parser missing '+str(missing))
    bp=OUT/'behavior_pack'
    rp=OUT/'resource_pack'
    bp.mkdir(parents=True,exist_ok=True)
    rp.mkdir(parents=True,exist_ok=True)
    bp_uuid=str(uuid.uuid5(UUID_NS,'a2-gameplay-bp'))
    rp_uuid=str(uuid.uuid5(UUID_NS,'a2-gameplay-rp'))
    write(bp/'manifest.json',{
      'format_version':2,
      'header':{'name':'Kaleidoscope Grilling A2.0 Gameplay Core BP','description':'固定串與三槽烤爐可玩核心；需要 Cookery 1.0.6','uuid':bp_uuid,'version':VERSION,'min_engine_version':[1,26,50]},
      'modules':[
        {'type':'data','uuid':str(uuid.uuid5(UUID_NS,'a2-gameplay-data')),'version':VERSION},
        {'type':'script','language':'javascript','entry':'scripts/main.js','uuid':str(uuid.uuid5(UUID_NS,'a2-gameplay-script')),'version':VERSION}
      ],
      'dependencies':[
        {'uuid':rp_uuid,'version':VERSION},
        {'uuid':COOKERY_BP,'version':COOKERY_VER},
        {'module_name':'@minecraft/server','version':'2.9.0'}
      ]
    })
    write(rp/'manifest.json',{
      'format_version':2,
      'header':{'name':'Kaleidoscope Grilling A2.0 Gameplay Core RP','description':'固定串與三槽烤爐可玩核心；需要 Cookery 1.0.6','uuid':rp_uuid,'version':VERSION,'min_engine_version':[1,26,50]},
      'modules':[{'type':'resources','uuid':str(uuid.uuid5(UUID_NS,'a2-gameplay-resources')),'version':VERSION}],
      'dependencies':[{'uuid':COOKERY_RP,'version':COOKERY_VER}]
    })
    write(OUT/'config.json',{
      'type':'minecraftBedrock','name':'Kaleidoscope Grilling A2.0 Gameplay Core','targetVersion':'1.26.50','namespace':NS,
      'packs':{'behaviorPack':'./behavior_pack','resourcePack':'./resource_pack'},
      'compiler':{'plugins':[['simpleRewrite',{'packName':'Kaleidoscope_Grilling_A2_Core'}]]}
    })
    grill_block={
      'format_version':'1.26.50',
      'minecraft:block':{
        'description':{
          'identifier':f'{NS}:grill',
          'menu_category':{'category':'items'},
          'traits':{'minecraft:placement_direction':{'enabled_states':['minecraft:cardinal_direction'],'y_rotation_offset':180.0}}
        },
        'components':{
          'minecraft:display_name':f'tile.{NS}:grill.name',
          'minecraft:block_entity':{'container':{'slot_count':3}},
          'minecraft:geometry':'geometry.kg_core.grill',
          'minecraft:material_instances':{'*':{'texture':'kg_core_grill','render_method':'alpha_test'}},
          'minecraft:collision_box':{'origin':[-8,0,-6],'size':[16,6,12]},
          'minecraft:selection_box':{'origin':[-8,0,-6],'size':[16,8,12]},
          'minecraft:destructible_by_mining':{'seconds_to_destroy':3},
          'minecraft:destructible_by_explosion':{'explosion_resistance':6}
        },
        'permutations':[
          {'condition':"q.block_state('minecraft:cardinal_direction') == 'north'",'components':{'minecraft:transformation':{'rotation':[0,0,0]}}},
          {'condition':"q.block_state('minecraft:cardinal_direction') == 'south'",'components':{'minecraft:transformation':{'rotation':[0,180,0]}}},
          {'condition':"q.block_state('minecraft:cardinal_direction') == 'west'",'components':{'minecraft:transformation':{'rotation':[0,90,0]}}},
          {'condition':"q.block_state('minecraft:cardinal_direction') == 'east'",'components':{'minecraft:transformation':{'rotation':[0,270,0]}}}
        ]
      }
    }
    write(bp/'blocks/grill.json',grill_block)
    geo=json.loads((SRC/'resource_pack/models/entity/kg_a1/grill_legged.geo.json').read_text())
    geo['minecraft:geometry'][0]['description']['identifier']='geometry.kg_core.grill'
    write(rp/'models/blocks/grill.geo.json',geo)
    (rp/'textures/blocks').mkdir(parents=True,exist_ok=True)
    shutil.copyfile(SRC/'resource_pack/textures/kg_a1/grill_unlit.png',rp/'textures/blocks/grill.png')
    write(rp/'textures/terrain_texture.json',{
      'resource_pack_name':'Kaleidoscope Grilling A2',
      'texture_name':'atlas.terrain',
      'texture_data':{'kg_core_grill':{'textures':'textures/blocks/grill'}}
    })
    icon_root=SRC/'source_snapshots/common/src/main/resources/assets/kaleidoscope_grilling/textures/item/fixed_skewers'
    texdata={}
    support={'canola_oil_brush','secret_chili_oil_brush','premium_chili_oil_brush','special_seasoning','empty_seasoning_bottle'}
    all_items=sorted(required|support)
    item_dir=bp/'items'
    item_dir.mkdir(parents=True,exist_ok=True)
    (rp/'textures/items').mkdir(parents=True,exist_ok=True)
    support_icon=SRC/'integration/immersion_lab/resource_pack/textures/kg_imm/lab_item.png'
    for item_id in sorted(required):
        src=icon_root/source_icon(item_id)
        if not src.is_file():
            if item_id in ('mysterious_skewer','dark_grilling'):
                src=icon_root/'ordinary_skewer.png'
            else:
                raise RuntimeError(f'missing icon for {item_id}: {src}')
        shutil.copyfile(src,rp/f'textures/items/{item_id}.png')
        texdata[item_id]={'textures':f'textures/items/{item_id}'}
    for i in ('canola_oil_brush','secret_chili_oil_brush','premium_chili_oil_brush'):
        specific=ROOT/'development/gameplay_core/fixtures/java-item-icons-1.1.1'/f'{i}.png'
        shutil.copyfile(specific,rp/f'textures/items/{i}.png')
        texdata[i]={'textures':f'textures/items/{i}'}
    for i in ('special_seasoning','empty_seasoning_bottle'):
        shutil.copyfile(support_icon,rp/f'textures/items/{i}.png')
        texdata[i]={'textures':f'textures/items/{i}'}
    write(rp/'textures/item_texture.json',{'resource_pack_name':'Kaleidoscope Grilling A2','texture_name':'atlas.items','texture_data':texdata})
    profiles={}
    raw_nausea={}
    for item_id in sorted(required):
        meta=food[item_id]
        profiles[f'{NS}:{item_id}']=meta['profile']
        raw_nausea[f'{NS}:{item_id}']=bool(nausea.get(item_id,False))
        use_seconds=5.0 if meta['profile']=='THREE' else 4.5
        components={
          'minecraft:display_name':{'value':f'item.{NS}:{item_id}.name'},
          'minecraft:icon':{'textures':{'default':item_id}},
          'minecraft:max_stack_size':1,
          'minecraft:allow_off_hand':True,
          'minecraft:hand_equipped':True,
          'minecraft:use_modifiers':{'start_using':'always','use_duration':use_seconds,'movement_modifier':0.35},
          'minecraft:food':{'can_always_eat':item_id=='ordinary_skewer','nutrition':meta['nutrition'],'saturation_modifier':meta['saturation']},
          'minecraft:use_animation':{'value':'eat'},
          'minecraft:tags':{'tags':['minecraft:is_food']}
        }
        write(item_dir/f'{item_id}.json',{
          'format_version':'1.26.30',
          'minecraft:item':{
            'description':{'identifier':f'{NS}:{item_id}','menu_category':{'category':'items'}},
            'components':components
          }
        })
    for item_id in sorted(support):
        write(item_dir/f'{item_id}.json',{
          'format_version':'1.26.30',
          'minecraft:item':{
            'description':{'identifier':f'{NS}:{item_id}','menu_category':{'category':'items'}},
            'components':{
              'minecraft:display_name':{'value':f'item.{NS}:{item_id}.name'},
              'minecraft:icon':{'textures':{'default':item_id}},
              'minecraft:max_stack_size':1,
              'minecraft:hand_equipped':True,
              **({'minecraft:allow_off_hand':True} if item_id in {'empty_seasoning_bottle','special_seasoning'} else {})
            }
          }
        })
    raw_map={k:v for k,v in raw_to_cooked.items()}
    effects={k:v for k,v in cooked_effects.items()}
    food_js={f'{NS}:{k}':{'nutrition':v['nutrition'],'saturation':v['saturation']} for k,v in food.items()}
    data_js='export const GRILL_ID="'+NS+':grill";\n'
    data_js+='export const SEASONING_ID="'+NS+':special_seasoning";\n'
    data_js+='export const EMPTY_SEASONING_ID="'+NS+':empty_seasoning_bottle";\n'
    data_js+='export const MYSTERIOUS_ID="'+NS+':mysterious_skewer";\n'
    data_js+='export const DARK_ID="'+NS+':dark_grilling";\n'
    data_js+='export const RAW_TO_COOKED=Object.freeze('+json.dumps(raw_map,separators=(',',':'))+');\n'
    data_js+='export const FOOD_DATA=Object.freeze('+json.dumps(food_js,separators=(',',':'))+');\n'
    data_js+='export const PROFILE_BY_ITEM=Object.freeze('+json.dumps(profiles,separators=(',',':'))+');\n'
    data_js+='export const COOKED_EFFECTS=Object.freeze('+json.dumps(effects,separators=(',',':'))+');\n'
    data_js+='export const RAW_NAUSEA=Object.freeze('+json.dumps(raw_nausea,separators=(',',':'))+');\n'
    data_js+='export const OIL_TOOLS=Object.freeze({"'+NS+':canola_oil_brush":1200,"'+NS+':secret_chili_oil_brush":12000,"'+NS+':premium_chili_oil_brush":24000});\n'
    write(bp/'scripts/data.js',data_js)
    shutil.copyfile(Path(__file__).parent/'core_logic.js',bp/'scripts/core_logic.js')
    shutil.copyfile(Path(__file__).parent/'runtime.js',bp/'scripts/main.js')
    write(bp/'scripts/package.json','{"type":"module"}\n')
    (rp/'animations').mkdir(parents=True,exist_ok=True)
    shutil.copyfile(SRC/'integration/immersion_lab/resource_pack/animations/player_binding.animation.json',rp/'animations/player_binding.animation.json')
    reset={
      'format_version':'1.8.0',
      'animations':{
        'animation.kg_core.player.reset':{
          'animation_length':.12,
          'override_previous_animation':True,
          'bones':{
            'rightarm':{'position':[0,0,0],'rotation':[0,0,0]},
            'leftarm':{'position':[0,0,0],'rotation':[0,0,0]},
            'rightitem':{'position':[0,0,0],'rotation':[0,0,0]},
            'leftitem':{'position':[0,0,0],'rotation':[0,0,0]}
          }
        }
      }
    }
    write(rp/'animations/reset.animation.json',reset)
    if (SRC/'integration/immersion_lab/resource_pack/sounds').exists():
        shutil.copytree(SRC/'integration/immersion_lab/resource_pack/sounds',rp/'sounds',dirs_exist_ok=True)
    zh_lines=[]
    en_lines=[]
    for item_id in all_items:
        src_key='item.kaleidoscope_grilling.'+item_id
        zh_name=zh.get(src_key,item_id.replace('_',' '))
        en_name=en.get(src_key,item_id.replace('_',' ').title())
        zh_lines.append(f'item.{NS}:{item_id}.name={zh_name}')
        en_lines.append(f'item.{NS}:{item_id}.name={en_name}')
    zh_lines.append(f'tile.{NS}:grill.name='+zh.get('block.kaleidoscope_grilling.grill','烤爐'))
    en_lines.append(f'tile.{NS}:grill.name='+en.get('block.kaleidoscope_grilling.grill','Grill'))
    (rp/'texts').mkdir(parents=True,exist_ok=True)
    write(rp/'texts/languages.json',['zh_CN','zh_TW','en_US'])
    write(rp/'texts/zh_CN.lang','\n'.join(zh_lines)+'\n')
    write(rp/'texts/zh_TW.lang','\n'.join(zh_lines)+'\n')
    write(rp/'texts/en_US.lang','\n'.join(en_lines)+'\n')
    report={
      'version':'A2.0.0',
      'java_commit':'9a1acdab27698457bec16c9362678e574895a28c',
      'cookable_fixed_skewers':len(recipes),
      'formal_skewer_items':len(required),
      'formal_support_items':len(support),
      'grill_slots':3,
      'finished_ticks':800,
      'burnt_ticks':400,
      'flip_count':4,
      'flip_cooldown':20,
      'cookery_dependency':{'bp':COOKERY_BP,'rp':COOKERY_RP,'version':COOKERY_VER},
      'source_git_blobs':EXPECTED,
      'known_parity_gaps':[
        'Cookery oil_pot direct integration uses temporary internal brush tools',
        'Cookery-specific status effects are reported but not silently approximated',
        'hot-food expiry and seasoning payload are written only as preliminary stack metadata',
        'per-grill phase state is persisted through stable world dynamic properties for retail 26.51; block dynamic-properties API is intentionally not required',
        'formal bite-stage item geometry switching is not yet wired; A1.16 player bone animations are reused',
        'all skewers temporarily max_stack_size=1 so per-stack state remains available',
        'Minecraft/BDS runtime not yet tested'
      ]
    }
    write(OUT/'reports/build.json',report)
    readme=(
      '# A2.0 Gameplay Core\n\n'
      '這是第一個正式 kaleidoscope_grilling 可玩核心，不是 kg_imm 驗收台。需要 Cookery 1.0.6。\n\n'
      '已實作：19組固定生串→熟串、普通串、三槽烤爐 block entity、點火、放串、刷油、四次翻面、20 tick 翻面冷卻、撒料、出爐、800 tick 過熟、再400 tick 木炭、破壞中途產生謎之／黑暗燒烤、真 food hunger/saturation、25 tick 提前進食檢查點、主副手食用骨骼動畫，以及能直接對應的原版 Minecraft Buff。\n\n'
      '暫未完成：Cookery 油壺本體資料接線、Cookery 專屬效果、熱食到期／調料內容對最終效果的完整作用、正式分口 attachable 切換、自由秘制串、榨油／大缸／厨具架／餐盤等 A2.x 後續系統。\n'
    )
    write(OUT/'README.zh-TW.md',readme)
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()
