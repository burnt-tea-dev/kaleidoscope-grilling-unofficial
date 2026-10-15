"""Guide A3 data checks. No player interaction or client UI is simulated."""
from __future__ import annotations
import argparse, itertools, json, re, struct, subprocess, sys
from pathlib import Path
from build_grilling_guide import ROOT,SOURCE,PROJECT,BP,RP,LOCALES,load,validate_source
GAME=ROOT/'projects/grilling/gameplay_core/behavior_pack'
GP=ROOT/'projects/grilling/gameplay_core/resource_pack'
BP_UUID='c68005c5-23ff-54e8-a3ff-da6349ad43c2'
RP_UUID='bbbd2d60-52e5-53a6-8b9a-c09b0f516389'
NS='kaleidoscope_grilling:'
GUIDE_BASE='8dc3e9d440577cd70501c377722f8e27b0913d44'

def require(ok,message):
    if not ok:raise AssertionError(message)
def pure(module,fn):
    code=f"import {{pathToFileURL}} from 'node:url';const m=await import(pathToFileURL(process.argv[1]));console.log(JSON.stringify(m.{fn}()));"
    return json.loads(subprocess.check_output(['node','--input-type=module','-e',code,str(GAME/'scripts'/module)],text=True,encoding='utf-8'))
def check_hidden_bottle_fill(item,owner):
    iid=item['description']['identifier']
    match=re.fullmatch(NS+r'(partial|pending)_seasoning_f([1-8])',iid)
    if not match:return False
    base=NS+('empty_seasoning_bottle' if match[1]=='partial' else 'pending_seasoning')
    require(item['description'].get('menu_category')=={'category':'none'} and base in owner,'Private fill entry leaked '+iid)
    original=load(GAME/'items'/(base.split(':')[-1]+'.json'))['minecraft:item']
    components=json.loads(json.dumps(item['components']))
    require(components['minecraft:icon']=={'textures':{'default':iid.split(':')[-1]}},'Fill icon identity drift '+iid)
    components['minecraft:icon']=original['components']['minecraft:icon']
    require(components==original['components'],'Fill proxy mechanic drift '+iid)
    return True

def check_hidden_cuisine_quality(item,owner):
    iid=item['description']['identifier']
    match=re.fullmatch(NS+r'(braised_chicken_wings|green_pepper_squid_tentacles|houttuynia_stir_fried_pork)_cuisine_q([0-3])',iid)
    if not match:return False
    require(tuple(load(GAME/'manifest.json')['header']['version'])>=(2,8,122),'Cuisine quality predates its G122 release '+iid)
    base=NS+match[1]
    require(base in owner,'Quality variant has no canonical dish page '+iid)
    original=load(GAME/'items'/(match[1]+'.json'))['minecraft:item']
    expected=json.loads(json.dumps(original))
    expected['description']['identifier']=iid
    expected['description'].pop('menu_category',None)
    rows=load(ROOT/'development/gameplay_core/fixtures/java-cuisine-quality-160.json')['neoforge_nutrition']
    values=[row for row in rows if row['baseId']==base and row['quality']==int(match[2])]
    require(len(values)==1,'Missing original Java quality food observation '+iid)
    row=values[0]
    expected['components']['minecraft:food']['nutrition']=row['nutrition']
    expected['components']['minecraft:food']['saturation_modifier']=struct.unpack('<f',struct.pack('<f',row['saturationGain']/(2*row['nutrition'])))[0]
    require(item==expected,'Quality variant changed identity, visibility or non-quality mechanics '+iid)
    return True

def guide_item_icon_key(item):
    """Keep the static guide illustration while validating its native GUI source."""
    c=item['components'];iid=item['description']['identifier']
    if 'minecraft:icon' in c:
        icon=c['minecraft:icon']
        return icon['textures']['default'] if isinstance(icon,dict) else icon
    stems={'grilled_slime_skewer':'grilled_slime_skewer_cooked','mysterious_skewer':'mysterious_skewer'}
    name=iid.removeprefix(NS)
    require(iid==NS+name and name in stems,'Unreviewed icon-less guide item '+iid)
    require(tuple(load(GAME/'manifest.json')['header']['version'])>=(2,8,144),'Native GUI predates G144')
    block_id=NS+'item_visual_'+name
    require(c.get('minecraft:block_placer')=={'block':block_id,'use_on':[{'tags':'0'}]},'Native GUI placement contract drift '+iid)
    block=load(GAME/'blocks'/('item_visual_'+name+'.json'))['minecraft:block']
    require(block['description']=={'identifier':block_id},'Native GUI block identity/menu drift '+iid)
    bc=block['components'];visual=bc['minecraft:item_visual']
    require(bc['minecraft:collision_box'] is False and bc['minecraft:selection_box'] is False,'Native GUI has physical bounds '+iid)
    require(visual['geometry']=={'identifier':'geometry.kg_native_icon.'+name},'Native GUI geometry drift '+iid)
    tile='kg_native_icon_'+name
    require(visual['material_instances']['*']['texture']==tile,'Native GUI material route drift '+iid)
    actual=load(GP/'textures/terrain_texture.json')['texture_data'][tile]['textures']
    require(actual=='textures/ui/kg_java/'+stems[name]+'_frame_0','Native GUI first-frame source drift '+iid)
    atlas=load(GP/'textures/item_texture.json')['texture_data']
    require(atlas[name]['textures']=='textures/items/'+name,'Static guide illustration route drift '+iid)
    from PIL import Image
    with Image.open(GP/(actual+'.png')) as native, Image.open(GP/('textures/items/'+name+'.png')) as guide:
        require(native.size==guide.size==(16,16) and native.convert('RGBA').tobytes()==guide.convert('RGBA').tobytes(),
                'Static guide illustration differs from original native first frame '+iid)
    return name

def check_facts(s):
    owner={}
    for e in s['entries']:
        for iid in [e['id'],*e.get('related_ids',[])]:
            require(iid not in owner,'Duplicate item page: '+iid);owner[iid]=e
    covered=0
    for path in (GAME/'items').glob('*.json'):
        item=load(path)['minecraft:item'];iid=item['description']['identifier']
        if iid.endswith(('_java_three_alt','_native_plain')):
            base=iid.removesuffix('_java_three_alt').removesuffix('_native_plain')
            require(base in owner and 'menu_category' not in item['description'],'Internal eating variant leaked '+iid)
            original=load(GAME/'items'/(base.split(':')[-1]+'.json'))['minecraft:item']
            require(item['components']['minecraft:food']==original['components']['minecraft:food'],'Variant food fact drift '+iid)
            continue
        if iid in s['excluded_items']:
            require(iid.endswith('_oil_brush') and item['description']['menu_category']['category']=='none','Unexpected hidden item '+iid)
            continue
        if re.fullmatch(NS+r'special_seasoning_r[1-8]_v[0-7]',iid):
            require(item['description']['menu_category']['category']=='none' and NS+'special_seasoning' in owner,'Private seasoning entry leaked');continue
        if check_hidden_bottle_fill(item,owner):continue
        if check_hidden_cuisine_quality(item,owner):continue
        require(iid in owner,'Item absent '+iid);covered+=1
    for e in s['entries']:
        pairs=dict(e.get('nutrition_variants',{}))
        if e.get('food'):pairs[e.get('food_item',e['id'])]=e['food']
        for iid,stats in pairs.items():
            f=load(GAME/'items'/(iid.split(':')[-1]+'.json'))['minecraft:item']['components']['minecraft:food']
            expected={'nutrition':f['nutrition'],'saturation':round(2*f['nutrition']*f['saturation_modifier'],4)}
            require(stats==expected and f['nutrition']>0,'Raw/cooked nutrition drift '+iid)
    fixed=pure('a24_skewering_core.js','recipeTable')
    for rr in fixed:
        e=owner[rr['id']]
        expected=[{'method':'Hand Threading','ingredients':['minecraft:stick',*combo],'count':1,'time':0,'result':rr['id']} for combo in itertools.product(*rr['slots'])]
        require([r for r in e['recipes'] if r['method']=='Hand Threading']==expected,'Threading recipe drift '+rr['id'])
        if rr['cooked']:
            require(owner[rr['cooked']] is e,'Raw/cooked must share a page '+rr['id'])
            require(any(r['method']=='Grill' and r['ingredients']==[rr['id']] and r['result']==rr['cooked'] for r in e['recipes']),'Cooked recipe missing')
        require(all(any('→' in x or '->' in x or 'order' in x.lower() for x in e['body'][l]) for l in LOCALES),'Recipe order missing '+rr['id'])
    host_count=0
    flex_pot=pure('a2750_wok_food_core.js','flexWokRecipes') if tuple(load(ROOT/'baseline.json')['version'])>=(2,8,122) else []
    for reg in pure('a2727_cookery_host_recipes_core.js','recipeTable'):
        r=reg['payload']['recipe'];kind=reg['payload']['kind']
        if kind=='chopping_board_v2':
            require(s.get('host_extension',{}).get('capability')=='chopping_board_v2','Host API dependency missing')
            if r['mode']=='replace':
                require(any(x['method']=='Chopping Board' and x['ingredients']==[r['input']] and x['count']==r['count'] for x in owner[r['result']]['recipes']),'V2 board recipe drift')
            else:
                for o in r['bonusOutputs']:
                    require(owner[o['id']]['acquisition']=='implemented_with_host_extension','Additive acquisition missing')
            host_count+=1;continue
        if kind=='stockpot_flex':continue
        if kind=='millstone':
            for o in r['outputs']:
                require(any(x['method']=='Millstone' and x['ingredients']==[r['input']] and x['count']==o['count'] for x in owner[o['id']]['recipes']),'Millstone recipe drift')
        elif kind=='chopping_board':
            require(any(x['method']=='Chopping Board' and x['ingredients']==[r['input']] and x['count']==r['count'] for x in owner[r['result']]['recipes']),'Board recipe drift')
        else:
            require(kind in {'wok','stockpot_exact'},'Unsupported guide recipe kind '+kind)
            method='Wok' if kind=='wok' else 'Stockpot';e=owner[r['result']]
            expected=[{'method':method,'ingredients':list(combo),'count':r.get('count',1),'time':r.get('time',0),'result':r['result']} for combo in itertools.product(*[x if isinstance(x,list) else [x] for x in r['ingredients']])]
            if kind=='wok':
                for flex in flex_pot:
                    if flex['result']==r['result']:
                        expected.extend({'method':'Wok','ingredients':list(combo),'count':flex['count'],'time':flex['time'],'result':flex['result']} for combo in itertools.product(*flex['ingredients']))
            require([x for x in e['recipes'] if x['method']==method]==expected,'Cookery exact recipe drift '+r['result'])
            if reg.get('requiresItems'):require(e.get('requires_any_item')==reg['requiresItems'],'Conditional Tavern requirement lost')
        host_count+=1
    constants={
        'core_logic.js':{'FINISHED_TICKS':800,'BURNT_TICKS':400,'FLIP_COOLDOWN':20,'REQUIRED_FLIPS':4},
        'a26_oil_machine_core.js':{'PRESS_MAX_CAKES':4,'PRESS_REQUIRED_PROGRESS':16,'PRESS_ANVIL_PROGRESS':4,'PRESS_STONE_PROGRESS':1,'PRESS_OUTPUT_BUCKETS':4,'VAT_CAPACITY_BUCKETS':8,'OIL_POT_CAPACITY':64,'OIL_BUCKET_POINTS':8},
        'a2743_seasoning_contract_core.js':{'SEASONING_CAPACITY':8,'SEASONING_MAX_BOTTLES':4,'SEASONING_MAX_USES':16},
        'a2746_advanced_rack_core.js':{'RACK_COMPARTMENTS':9,'RACK_RANGE':8}}
    for file,expected in constants.items():
        text=(GAME/'scripts'/file).read_text(encoding='utf-8')
        for name,n in expected.items():
            m=re.search(r'export const '+name+r'\s*=\s*(\d+)',text);require(m and int(m[1])==n,'Runtime constant changed '+name)
    for iid,tokens in {NS+'grill':['40','20','4'],NS+'oil_press':['16','4'],NS+'big_vat':['8'],NS+'special_seasoning':['8','4','16'],NS+'advanced_rack':['9','8'],'kaleidoscope_cookery:oil_pot_filled':['64','8'],NS+'wedding_candy':['2026','12']}.items():
        for loc in LOCALES:require(all(t in '\n'.join(owner[iid]['body'][loc]) for t in tokens),'Visible fact missing '+iid+' '+loc)
    data=(GAME/'scripts/data.js').read_text(encoding='utf-8')
    effects=json.loads(data.split('export const COOKED_EFFECTS=Object.freeze(',1)[1].split(');',1)[0])
    for iid,fx in effects.items():
        if fx['seconds']:
            for loc in LOCALES:require(str(fx['seconds']) in '\n'.join(owner[iid]['body'][loc]),'Effect duration missing '+iid)
    atlas=load(GP/'textures/item_texture.json')['texture_data']
    for row in s['icon_sources'].values():
        if row.get('plant_sprite'):continue
        item=load(GAME/'items'/(row['item'].split(':')[-1]+'.json'))['minecraft:item']
        key=guide_item_icon_key(item)
        require(key==row['atlas_key'],'Wrong item icon key '+row['item'])
        actual=atlas[key]['textures'];actual=actual[0] if isinstance(actual,list) else actual
        expected=(GP/(actual if actual.endswith('.png') else actual+'.png')).relative_to(ROOT).as_posix()
        require(row['source']==expected,'Icon atlas mismatch '+row['item'])
    return {'canonical_items_covered':covered,'fixed_skewer_recipes':len(fixed),'cookery_exact_processing_recipes':host_count,'nutrition_items_checked':sum(bool(e.get('food')) for e in s['entries']),'legacy_brushes_excluded':len(s['excluded_items'])}

def compiled_compare():
    dist=PROJECT/'builds/dist';total=0
    for source,uid in [(BP,BP_UUID),(RP,RP_UUID)]:
        matches=[p.parent for p in dist.rglob('manifest.json') if load(p).get('header',{}).get('uuid')==uid]
        require(len(matches)==1,'Compiled pack not uniquely located '+uid)
        for p in source.rglob('*'):
            if not p.is_file() or p.name.startswith('.'):continue
            q=matches[0]/p.relative_to(source);require(q.is_file(),'Compiled file missing '+str(p))
            require(load(p)==load(q) if p.suffix=='.json' else p.read_bytes()==q.read_bytes(),'Compiled output drift '+str(p));total+=1
    return total

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--compiled',action='store_true');args=ap.parse_args()
    s=load(SOURCE);validate_source(s)
    subprocess.run([sys.executable,str(ROOT/'tools/build_grilling_guide.py'),'--check'],check=True)
    facts=check_facts(s)
    require([c['id'] for c in s['categories'] if not c.get('parent')]==s['host_reference']['root_category_ids'],'Host taxonomy drift')
    if tuple(load(ROOT/'baseline.json')['version'])>=(2,8,72):
        ref=load(ROOT/'tools/fixtures/cookery-160-reference.json')
        require(all(s['host_reference'][key]==value for key,value in ref.items()),'Cookery 1.6.0 reviewed reference differs')
    else:
        require(s['host_reference']['version']=='1.0.8' and s['host_reference']['guide_sha256']=='49ea47f9dc7511af210562118c7d2164ab5e185296a5a8c8d678e7d7ff8dc959','Host evidence drift')
        require(s['host_reference']['archive_sha256']=='9e5b617cc4c7a08ecd429fb9e42ec10e8d40a1ed5fc1f6f6687c3aff8a45a5d5' and s['host_reference']['file_id']==8983314,'Unverified original host archive')
    # The guide is part of the EXISTING product, not a guide pack.
    require(not (ROOT/'projects/grilling/integration/cookery106/behavior_pack/manifest.json').exists(),'Standalone guide BP resurrected')
    require(not (ROOT/'projects/grilling/integration/cookery106/resource_pack/manifest.json').exists(),'Standalone guide RP resurrected')
    require(not (ROOT/'.github/workflows/guide-canonical.yml').exists(),'Standalone guide publication workflow resurrected')
    require(not (BP/'items/guidebook.json').exists(),'Do not create a second physical guidebook')
    require(not (RP/'entity/player.entity.json').exists(),'Do not replace the host player definition')
    require(set(p.name for p in (BP/'scripts/guide').glob('*.js'))=={'main.js','payload.js','publisher.js'},'Guide module contents drift')
    startup=(BP/'scripts/main.js').read_text(encoding='utf-8')
    require(startup.count("import './guide/main.js';")==1,'Guide must load exactly once from the product entry')
    version=load(BP/'manifest.json')['header']['version']
    if tuple(version)==(2,8,121):
        # This host bridge release changes only the Grilling guide's identity.
        # Keep the independently reviewed G120 content and existing locale checks.
        previous_source=json.loads(subprocess.check_output(['git','show',GUIDE_BASE+':'+SOURCE.relative_to(ROOT).as_posix()],cwd=ROOT))
        current_source=json.loads(json.dumps(s))
        require(previous_source.pop('version')=='0.3.50' and current_source.pop('version')=='0.3.51','G121 guide identity differs')
        require(current_source==previous_source,'G121 changed reviewed G120 guide content')
    for pack,uid in [(BP,BP_UUID),(RP,RP_UUID)]:
        m=load(pack/'manifest.json');require(m['header']['uuid']==uid and m['header']['version']==version,'Product UUID/version drift')
        require(all(x['version']==version for x in m['modules']),'Module version drift')
    bm=load(BP/'manifest.json')
    require([m.get('entry') for m in bm['modules'] if m.get('type')=='script']==['scripts/main.js'],'Product has a second script entry')
    require(any(d.get('uuid')==RP_UUID and d['version']==version for d in bm['dependencies']),'BP/RP dependency drift')
    require(not any(d.get('uuid') in {'f8c367c2-84d6-5bf6-b5a8-1bbe6cdb93ab','32baef08-6b04-5115-9d5b-2d4ba2d3a7b4'} for d in bm['dependencies']),'Legacy guide pack dependency')
    pub=(BP/'scripts/guide/publisher.js').read_text();require(f"REVISION = '{s['revision']}'" in pub,'Publisher revision drift')
    for p in (BP/'scripts/guide').glob('*.js'):subprocess.run(['node','--check',str(p)],check=True)
    code="import {pathToFileURL} from 'node:url';const root=process.argv[1];const p=await import(pathToFileURL(root+'/payload.js'));const m=await import(pathToFileURL(root+'/publisher.js'));const rows=m.encodeMessages(p.GUIDE_PAYLOAD);console.log(JSON.stringify({messages:rows.length,max:Math.max(...rows.map(x=>x.message.length))}));"
    frames=json.loads(subprocess.check_output(['node','--input-type=module','-e',code,str(BP/'scripts/guide')],text=True,encoding='utf-8'))
    require(frames['max']<=2048,'Script Event length')
    print(json.dumps({'built_into_grilling':True,'product_version':version,'guide_data_version':s['version'],'entries':len(s['entries']),'categories':len(s['categories']),'recipe_variants':sum(len(e.get('recipes',[])) for e in s['entries']),**facts,'script_event_serialization':frames,'compiled_files':compiled_compare() if args.compiled else None,'validation_boundary':'Static source/data/serialization/packaging checks only; no player or client UI interaction was simulated.'},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
