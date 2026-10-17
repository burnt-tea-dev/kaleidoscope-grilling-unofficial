"""Build world display assets from current meshes and checksum-pinned Java stages.

This edits canonical source only. Packaging never runs an asset/gameplay transform.
"""
from pathlib import Path
from copy import deepcopy
import argparse, hashlib, io, json, re, zipfile
from PIL import Image
from secret_skewer_assets import geometry as secret_geometry,slot_cubes,shaft_cubes,completed_geometries,COMPLETE_STATES,palette_refs,palette_keys
from held_visual_channels import FOOD_COUNT, SECRET_VISUAL_MAX

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / 'projects/grilling/gameplay_core'
RP, BP = P / 'resource_pack', P / 'behavior_pack'
FIX = ROOT / 'development/gameplay_core/fixtures/released-grill-1.1.1'
JAR_SHA = 'cf31071e4ba790bcd5c1d3f6005439bc512acba084e70b8ab6a767e8c8f99dd6'
NS = 'kaleidoscope_grilling:'
ENTITY = NS + 'grill_food_visual'

def dump(v): return (json.dumps(v, ensure_ascii=False, indent=2) + '\n').encode()
def sha(v): return hashlib.sha256(v).hexdigest()

def build(jar=None):
    archive = zipfile.ZipFile(jar) if jar else None
    if jar: assert sha(jar.read_bytes()) == JAR_SHA, 'unreviewed Java release'
    used, output = {}, {}
    def source(path):
        if archive:
            data = archive.read(path)
            target = FIX / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        else: data = (FIX / path).read_bytes()
        used[path] = sha(data)
        return data
    def model(name, chain=()):
        assert name not in chain and len(chain) < 12
        ns, path = name.split(':', 1)
        doc = json.loads(source(f'assets/{ns}/models/{path}.json'))
        parent = doc.get('parent', '')
        base = model(parent, (*chain, name)) if parent.startswith(NS) else {}
        return {**base, **doc, 'textures': {**base.get('textures', {}), **doc.get('textures', {})}}
    def texture(doc, ref):
        seen = set()
        while ref.startswith('#'):
            assert ref not in seen; seen.add(ref); ref = doc['textures'][ref[1:]]
        ns, path = ref.split(':', 1)
        return Image.open(io.BytesIO(source(f'assets/{ns}/textures/{path}.png'))).convert('RGBA')
    pairs = json.loads(re.search(r'RAW_TO_COOKED=Object.freeze\((\{.*?\})\)', (BP/'scripts/data.js').read_text()).group(1))
    assert len(pairs) == 19
    geometries, texture_refs, geometry_refs, indices = [], {}, {}, {}
    for index, raw_id in enumerate(sorted(pairs)):
        name = raw_id.split(':')[1]
        base = model(NS + 'item/' + name)
        stages = [base]
        overrides = {round(o['predicate'].get(NS+'skewer_cooking_stage', -1)*5): o['model'] for o in base.get('overrides', []) if NS+'skewer_cooking_stage' in o['predicate']}
        for stage in range(1, 6): stages.append(model(overrides[stage]) if stage in overrides else base)
        assert all(d['elements'] == base['elements'] for d in stages), 'stage changes geometry: '+name
        # Existing hand atlas already encodes UV direction and cube rotations.
        # Find each source texture column by exact RGBA, never by guessed key order.
        atlas = Image.open(RP/f'textures/a22_bites/{name}_stage0.png').convert('RGBA')
        assert atlas.height == 16 and atlas.width % 16 == 0
        refs = sorted({f['texture'] for e in base['elements'] for f in e['faces'].values()})
        columns = []
        for column in range(atlas.width//16):
            pixels = atlas.crop((column*16,0,column*16+16,16)).tobytes()
            matches = [ref for ref in refs if texture(base,ref).size==(16,16) and texture(base,ref).tobytes()==pixels]
            assert len(matches) == 1, (name,column,matches)
            columns.append(matches[0])
        geo = deepcopy(json.loads((RP/f'models/entity/a22_bites/{name}_stage0.geo.json').read_text())['minecraft:geometry'][0])
        geo['description'].update(identifier='geometry.kg_station.grill.'+name, visible_bounds_width=2, visible_bounds_height=2, visible_bounds_offset=[0,.3,0])
        bones = []
        for b in geo['bones']:
            if b['name'] == 'display': continue
            b.pop('binding',None)
            if b['name'] != 'root':
                if b.get('parent') == 'display': b['parent'] = 'root'
                if 'pivot' in b: b['pivot'][1] -= 1
                for c in b.get('cubes',[]):
                    c['origin'][1] -= 1
                    if 'pivot' in c: c['pivot'][1] -= 1
            bones.append(b)
        geo['bones'] = bones; geometries.append(geo)
        for stage, doc in enumerate(stages):
            value = index*6+stage; key = 's'+str(value)
            result = Image.new('RGBA',atlas.size)
            for column, ref in enumerate(columns):
                image = texture(doc,ref); assert image.size==(16,16)
                result.paste(image,(column*16,0))
            stream=io.BytesIO();result.save(stream,format='PNG',compress_level=9)
            output[RP/f'textures/grill_display/{name}_{stage}.png']=stream.getvalue()
            texture_refs[key]=f'textures/grill_display/{name}_{stage}'
            geometry_refs[key]=geo['description']['identifier']
        indices[raw_id]=index
    # The secret world pass uses the same pinned volumetric cells/palettes as
    # held rendering. No separate native raw-item-icon food overlays remain.
    texture_refs['s114']='textures/secret_skewer_stick'
    geometry_refs['s114']='geometry.kg_station.grill.secret_stick'
    geometries.append(secret_geometry(geometry_refs['s114'],shaft_cubes(),shaft=True))
    texture_refs.update(palette_refs(FOOD_COUNT))
    for slot in range(3):
        alias=f'secret_{slot}_0';identifier='geometry.kg_station.grill.'+alias
        geometries.append(secret_geometry(identifier,[]));geometry_refs[alias]=identifier
    for geo in completed_geometries():
        identifier=geo['description']['identifier'];geometry_refs[identifier.rsplit('.',1)[1]]=identifier;geometries.append(geo)
    secret_reads=[]
    for slot in range(3):
        packed=f'v.kg_secret_ingredient_{slot}';food=f'v.kg_secret_food_{slot}';shape=f'v.kg_secret_shape_{slot}';style=f'v.kg_secret_style_{slot}'
        secret_reads += [packed+" = q.property('"+NS+f"secret_{slot}');",
            food+' = '+packed+' - math.floor('+packed+'/256)*256;',
            food+' = '+food+' <= '+str(FOOD_COUNT)+' ? '+food+' : 0;',
            shape+' = math.floor('+packed+'/256) - 3*math.floor('+packed+'/768) + 1;',
            style+' = math.floor('+packed+'/768);']
    secret_reads.append('v.kg_secret_state = v.kg_secret_shape_0*16 + v.kg_secret_shape_1*4 + v.kg_secret_shape_2;')
    output[RP/'models/entity/grill_display.geo.json']=dump({'format_version':'1.16.0','minecraft:geometry':geometries})
    prop=lambda k: "q.property('"+NS+k+"')"
    output[RP/'entity/grill_food_visual.entity.json']=dump({'format_version':'1.10.0','minecraft:client_entity':{'description':{
        'identifier':ENTITY,'materials':{'default':'entity_alphatest_one_sided'},'textures':texture_refs,'geometry':geometry_refs,
        'scripts':{'initialize':['v.previous_flips = -1;','v.flip_started = -1;'],
        'pre_animation':[f"v.flip_started = {prop('flips')} == 0 ? -1 : v.previous_flips >= 0 && v.previous_flips != {prop('flips')} && {prop('flips')} > 0 ? q.life_time : v.flip_started;",f"v.previous_flips = {prop('flips')};","v.flip_progress = v.flip_started < 0 ? 1 : math.clamp((q.life_time-v.flip_started)/0.7,0,1);"]+secret_reads,
        'animate':['flip']},'animations':{'flip':'animation.kg_station.grill_flip'},
        'render_controllers':[{'controller.render.kg_station.grill':prop('ready')}]+[{'controller.render.kg_station.secret.'+str(slot):prop('ready')+' && '+prop('model')+' == 114'}for slot in range(3)]
    }}})
    output[RP/'render_controllers/grill_food_visual.render_controllers.json']=dump({'format_version':'1.8.0','render_controllers':{
        'controller.render.kg_station.grill':{'arrays':{'geometries':{'Array.models':['Geometry.s'+str(i) for i in range(115)]},'textures':{'Array.stages':['Texture.s'+str(i) for i in range(115)]}},
        'geometry':'Array.models['+prop('model')+']','materials':[{'*':'Material.default'}],'textures':['Array.stages['+prop('model')+']']}}})
    controller_doc=json.loads(output[RP/'render_controllers/grill_food_visual.render_controllers.json'])
    for slot in range(3):
        food=f'v.kg_secret_food_{slot}';shape=f'v.kg_secret_shape_{slot}';style=f'v.kg_secret_style_{slot}'
        controller_doc['render_controllers']['controller.render.kg_station.secret.'+str(slot)]={
            'arrays':{'geometries':{'Array.states':['Geometry.state_'+str(i)+'_'+str(slot)if i in COMPLETE_STATES else 'Geometry.secret_'+str(slot)+'_0'for i in range(64)]},
                      'textures':{'Array.food':['Texture.'+key for key in palette_keys(FOOD_COUNT)]}},
            'geometry':'Array.states['+food+' == 0 ? 0 : v.kg_secret_state]','materials':[{'*':'Material.default'}],
            'textures':['Array.food['+food+' + '+style+' * '+str(FOOD_COUNT+1)+']'],'part_visibility':[{'*':0},{'secret_model':1}]}
    output[RP/'render_controllers/grill_food_visual.render_controllers.json']=dump(controller_doc)
    output[RP/'animations/grill_food_visual.animation.json']=dump({'format_version':'1.8.0','animations':{'animation.kg_station.grill_flip':{
        'loop':True,'bones':{'root':{'rotation':[0,0,f"-180*({prop('flips')}>0 && v.flip_progress<1 ? {prop('flips')}-1+v.flip_progress : {prop('flips')})"],
        'position':[0,f"math.sin(180*v.flip_progress)*{prop('hop')}/1000*16",0]}}}}})
    output[BP/'entities/grill_food_visual.json']=dump({'format_version':'1.26.0','minecraft:entity':{'description':{
        'identifier':ENTITY,'is_spawnable':False,'is_summonable':True,'is_experimental':False,'properties':{
        NS+'ready':{'type':'bool','default':False,'client_sync':True},NS+'model':{'type':'int','range':[0,114],'default':0,'client_sync':True},
        NS+'flips':{'type':'int','range':[0,4],'default':0,'client_sync':True},NS+'hop':{'type':'int','range':[280,380],'default':280,'client_sync':True}}},
        'components':{'minecraft:type_family':{'family':['kg_render_helper']},'minecraft:transient':{},
        'minecraft:physics':{'has_gravity':False,'has_collision':False},'minecraft:collision_box':{'width':0,'height':0},
        'minecraft:pushable':{'is_pushable':False,'is_pushable_by_piston':False},'minecraft:damage_sensor':{'triggers':[{'cause':'all','deals_damage':'no'}]},'minecraft:fire_immune':{}}}})
    entity_doc=json.loads(output[BP/'entities/grill_food_visual.json'])
    for slot in range(3):entity_doc['minecraft:entity']['description']['properties'][NS+'secret_'+str(slot)]={'type':'int','range':[0,SECRET_VISUAL_MAX],'default':0,'client_sync':True}
    output[BP/'entities/grill_food_visual.json']=dump(entity_doc)
    output[BP/'scripts/grill_visual_data.js']=b'// Generated by tools/build_grill_display.py from the pinned Java release.\nexport const GRILL_MODEL_INDEX=Object.freeze('+json.dumps(indices,sort_keys=True,separators=(',',':')).encode()+b');\n'
    output[FIX/'source-manifest.json']=dump({'java_version':'1.1.1-neoforge1.21.1','jar_sha256':JAR_SHA,'source_url':'https://www.curseforge.com/minecraft/mc-mods/kaleidoscope-grilling/files/8726014','files':used,'fixed_skewers':19,'cooking_stages':6,'secret_personalized_mesh':True,'secret_mesh_pin':'9a1acdab27698457bec16c9362678e574895a28c','secret_palette_sources':'../secret-food-palettes.json','client_acceptance':False})
    return output

def main():
    p=argparse.ArgumentParser();p.add_argument('--import-jar',type=Path);p.add_argument('--check',action='store_true');a=p.parse_args()
    output=build(a.import_jar)
    for path,data in output.items():
        if a.check:
            assert path.is_file(),path
            if path.suffix=='.png':assert Image.open(path).convert('RGBA').tobytes()==Image.open(io.BytesIO(data)).convert('RGBA').tobytes(),path
            else:assert path.read_bytes()==data,path
        else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
    proof=json.loads((FIX/'source-manifest.json').read_text())
    for path,digest in proof['files'].items():assert sha((FIX/path).read_bytes())==digest,path
    print(f'Grill world display: 19 fixed meshes, 114 cooking textures; {len(proof["files"])} pinned Java source files; client acceptance false')
if __name__=='__main__':main()
