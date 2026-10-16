"""Derived placed assets: exact JSON/JS bytes and exact PNG RGBA pixels.
Canonical source/dist and committed runtime hashes remain byte-for-byte checks.
"""
from pathlib import Path
from copy import deepcopy
from collections import Counter
import argparse,base64,hashlib,io,json,os,re,urllib.request
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
P=ROOT/'projects/grilling/gameplay_core'; BP=P/'behavior_pack'; RP=P/'resource_pack'
VENDOR=ROOT/'development/gameplay_core/fixtures/a2770'
JAVA='9a1acdab27698457bec16c9362678e574895a28c'
JAVA_BASE='common/src/main/resources/assets/'
COOKERY_MODEL='b62e867e2b05e1a4766c152e112400ae8fa90b3f'
NS='kaleidoscope_grilling:'
OUT={}; SOURCES={}; ALLOW_FETCH=False
TINT_VALUES=[]
TINT_COLUMNS=8

def dump(value):return (json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode()
def load(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def builtin_seasoning_ingredient_ids(behavior_root=None):
 behavior_root=BP if behavior_root is None else Path(behavior_root)
 contract=(behavior_root/'scripts/a2743_seasoning_contract_core.js').read_text()
 body=re.search(r'SEASONING_KINDS=Object.freeze\((\{.*?\})\)',contract,re.S).group(1)
 ids=re.findall(r"'([^']+)'\s*:",body)
 if '...DEFAULT_SEASONING_EFFECTS' in body:
  # Static palette inputs only: G124 shares six defaults plus two bases.
  # Live providers cannot add runtime textures, and source JS is not evaluated.
  defaults=(behavior_root/'scripts/seasoning_registry_core.js').read_text()
  block=re.search(r'DEFAULT_SEASONING_EFFECTS=Object.freeze\((\{.*?\})\)',defaults,re.S)
  assert block is not None,'Static seasoning defaults are not readable'
  ids+=re.findall(r"'([^']+)'\s*:",block.group(1))
 ids=sorted(ids);assert len(ids)==8 and len(set(ids))==8
 return ids
def sha(data):return hashlib.sha256(data).hexdigest()
def blob(data):return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def out(path,value):OUT[path.relative_to(ROOT).as_posix()]=value if isinstance(value,bytes) else dump(value)
def download(url):
 req=urllib.request.Request(url,headers={'User-Agent':'Grilling-placed-visuals/1'})
 with urllib.request.urlopen(req,timeout=90) as response:return response.read()
def source(path):
 target=VENDOR/'grilling'/path
 if not target.is_file():
  assert ALLOW_FETCH,('missing pinned fixture',path)
  data=download('https://raw.githubusercontent.com/breezeth-CN/KaleidoscopeGrilling/'+JAVA+'/'+JAVA_BASE+path)
  target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
 data=target.read_bytes();SOURCES['grilling/'+path]=blob(data);return data

def model(name,chain=()):
 assert name not in chain and len(chain)<12,('model cycle',name)
 namespace,path=name.split(':',1)
 doc=json.loads(source(namespace+'/models/'+path+'.json'))
 parent=doc.get('parent');result={}
 if parent and not parent.startswith(('minecraft:','builtin/')):result=model(parent,(*chain,name))
 result=deepcopy(result)
 result['textures']={**result.get('textures',{}),**doc.get('textures',{})}
 for k,v in doc.items():
  if k!='textures':result[k]=v
 return result

def texture(doc,key):
 visited=set()
 while key.startswith('#'):
  assert key not in visited;visited.add(key);key=doc['textures'][key[1:]]
 namespace,path=key.split(':',1)
 return Image.open(io.BytesIO(source(namespace+'/textures/'+path+'.png'))).convert('RGBA')

def png(image):
 stream=io.BytesIO();image.save(stream,format='PNG',compress_level=9);return stream.getvalue()
def geo(identifier,cubes,width=32,height=32):
 return {'description':{'identifier':identifier,'texture_width':width,'texture_height':height,
  'visible_bounds_width':3,'visible_bounds_height':2,'visible_bounds_offset':[0,.5,0]},
  'bones':[{'name':'root','pivot':[0,0,0],'cubes':cubes}]}

def convert(doc,identifier,tint=None,image_override=None,inflate=0):
 faces=[];cubes=[]
 for element in doc.get('elements',[]):
  if element.get('rotation',{}).get('angle',0)!=0:raise ValueError('unexpected rotated source element')
  selected={k:v for k,v in element.get('faces',{}).items() if tint is None or v.get('tintindex')==tint}
  if not selected:continue
  start,end=element['from'],element['to'];size=[end[i]-start[i] for i in range(3)]
  if min(size)<=0:continue
  cube={'origin':[start[0]-8,start[1],start[2]-8],'size':size,'uv':{}}
  if inflate:cube['inflate']=inflate
  for face,spec in selected.items():
   image=image_override or texture(doc,spec['texture'])
   u0,v0,u1,v1=spec.get('uv',[0,0,16,16]);sx=image.width/16;sy=image.height/16
   box=(round(min(u0,u1)*sx),round(min(v0,v1)*sy),round(max(u0,u1)*sx),round(max(v0,v1)*sy))
   assert box[2]>box[0] and box[3]>box[1],('zero UV area',identifier,face)
   patch=image.crop(box)
   if u1<u0:patch=patch.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
   if v1<v0:patch=patch.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
   angle=int(spec.get('rotation',0));assert angle in (0,90,180,270)
   if angle:patch=patch.rotate(-angle,expand=True)
   index=len(faces);x=(index%8)*32;y=(index//8)*32
   faces.append((patch.resize((32,32),Image.Resampling.NEAREST),x,y))
   cube['uv'][face]={'uv':[x+32,y+32],'uv_size':[-32,-32]} if face in ('up','down') else {'uv':[x,y],'uv_size':[32,32]}
  cubes.append(cube)
 assert cubes,('no source cubes',identifier,tint)
 height=max(32,1<<((int((len(faces)+7)//8)*32-1).bit_length()))
 atlas=Image.new('RGBA',(256,height),(0,0,0,0))
 for patch,x,y in faces:atlas.paste(patch,(x,y))
 return geo(identifier,cubes,256,height),atlas

def entity(identifier,properties):
 props={NS+'ready':{'type':'bool','default':False,'client_sync':True}}
 props.update({NS+k:{'type':'int','range':v,'default':0,'client_sync':True} for k,v in properties.items()})
 assert len(props)<=32
 return {'format_version':'1.26.0','minecraft:entity':{
  'description':{'identifier':identifier,'is_spawnable':False,'is_summonable':True,'is_experimental':False,'properties':props},
  'components':{'minecraft:type_family':{'family':['kg_render_helper']},'minecraft:transient':{},
   'minecraft:physics':{'has_gravity':False,'has_collision':False},
   'minecraft:collision_box':{'width':0,'height':0},'minecraft:pushable':{'is_pushable':False,'is_pushable_by_piston':False},
   'minecraft:damage_sensor':{'triggers':[{'cause':'all','deals_damage':'no'}]},'minecraft:fire_immune':{}}}}

def pending_assets(controllers,description,geometries):
 doc=model('kaleidoscope_grilling:item/pending_seasoning')
 choices=[r for r in doc.get('overrides',[]) if r.get('predicate',{}).get(NS+'seasoning_fill')==1]
 assert choices,'missing Java full pending model override'
 full=model(choices[-1]['model'])
 tints={f['tintindex'] for e in full['elements'] for f in e.get('faces',{}).values() if 'tintindex' in f}
 assert tints==set(range(16)),('pending source tint indices',sorted(tints))
 # The Java fill mask is opaque white. Select exact solid-color textures
 # directly: a UV-animated atlas adds a texture-coordinate dependency to an
 # otherwise constant source face and can expose transparent unused tiles.
 mask=texture(full,'#fill')
 assert mask.getextrema()==((255,255),)*4,'Java fill-mask changes require a new converter'
 # Retain the original source tiles/geometries for the held converter and
 # historical source audits, but render all pending halves in one pass. Each
 # ingredient has a stable one-hot selector shared with the held bottle.
 for index,rgb in enumerate(TINT_VALUES):
  key='pending_color_'+str(index)
  out(RP/('textures/a2770_placed/'+key+'.png'),png(Image.new('RGBA',(16,16),((rgb>>16)&255,(rgb>>8)&255,rgb&255,255))))
 palette=ingredient_palette()
 ids=builtin_seasoning_ingredient_ids()
 pairs=[None]+[palette[id] for id in ids]+[[0xB86B45,0xE0A56A]]
 colors=sorted({rgb for pair in pairs[1:] for rgb in pair})
 assert len(colors)==18
 atlas=Image.new('RGBA',(128,64),(0,0,0,0));tiles={}
 for index,rgb in enumerate(colors):
  x=(index%8)*16;y=(index//8)*16;tiles[rgb]=[x+4,y+4]
  atlas.paste(Image.new('RGBA',(16,16),((rgb>>16)&255,(rgb>>8)&255,rgb&255,255)),(x,y))
 description['textures']['pending']='textures/a2770_placed/pending_palette'
 out(RP/'textures/a2770_placed/pending_palette.png',png(atlas))
 combined=geo('geometry.kg_a2770.pending_combined',[],128,64)
 combined['bones']=[{'name':'root','pivot':[0,0,0]}]
 visibility=[{'*':False},{'root':True}]
 for tint in range(16):
  identifier='geometry.kg_a2770.pending_'+str(tint)
  g,_=convert(full,identifier,tint=tint)
  g['description']['texture_width']=g['description']['texture_height']=16
  for bone in g['bones']:
   for cube in bone.get('cubes',[]):
    # The bottle shell already uses Java-to-Bedrock X reflection. Match it
    # without reversing tint order: [from.x, to.x] -> [8-to.x, 8-from.x].
    # These faces all use the checked solid-white mask, so face orientation
    # cannot alter their palette color. Keep other placed converters unchanged.
    cube['origin'][0]=-cube['origin'][0]-cube['size'][0]
    for face in cube['uv']:
     cube['uv'][face]={'uv':[16,16],'uv_size':[-16,-16]} if face in ('up','down') else {'uv':[0,0],'uv_size':[16,16]}
  geometries.append(g)
  for value in range(1,10):
   name=f'pending_{tint}_color_{value}'
   bone=deepcopy(g['bones'][0]);bone.update(name=name,parent='root')
   uv=tiles[pairs[value][tint%2]]
   for cube in bone['cubes']:
    cube['uv']={face:{'uv':uv[:],'uv_size':[8,8]} for face in cube['uv']}
   combined['bones'].append(bone)
   visibility.append({name:"q.property('"+NS+'layer_'+str(tint//2)+"') == "+str(value)})
 description['geometry']['pending']=combined['description']['identifier']
 out(RP/'models/entity/a2770_placed/pending_combined.geo.json',{'format_version':'1.16.0','minecraft:geometry':[combined]})
 rc='controller.render.kg_a2770.pending'
 controllers[rc]={'geometry':'Geometry.pending','materials':[{'*':'Material.default'}],
  'textures':['Texture.pending'],'part_visibility':visibility}
 description['render_controllers'].append({rc:"q.property('"+NS+"ready') && q.property('"+NS+"mode') == 1"})

def seasoning_assets(controllers):
 desc={'identifier':NS+'placed_seasoning_visual','materials':{'default':'entity_alphatest'},
  'textures':{},'geometry':{},'render_controllers':[]}
 geometries=[];aliases=[]
 for r in range(1,9):
  for v in range(5):
   file=RP/f'models/entity/a2766_special_seasoning/special_seasoning_r{r}_v{v}.geo.json'
   original=load(file)['minecraft:geometry'][0]
   cubes=[]
   for bone in original['bones']:
    if 'spice_fill' not in bone['name']:continue
    for cube in bone.get('cubes',[]):
     cube=deepcopy(cube);cube['origin'][1]+=6
     if 'pivot' in cube:cube['pivot'][1]+=6
     assert cube['size']==[5,5*r/8,5],(file,cube['size'])
     cubes.append(cube)
   assert len(cubes)==1,(file,len(cubes))
   key=f'r{r}v{v}';identifier='geometry.kg_a2770.seasoning.'+key
   geometries.append(geo(identifier,cubes));desc['geometry'][key]=identifier;aliases.append('Geometry.'+key)
 desc['textures']={'default':'textures/blocks/seasoning_bottle',**{f'v{v}':f'textures/a2766_special_seasoning/palette_v{v}' for v in (5,6,7)}}
 rc='controller.render.kg_a2770.seasoning'
 level="math.clamp(q.property('"+NS+"fill'),1,8)"
 variant="q.property('"+NS+"variant')"
 controllers[rc]={'arrays':{'geometries':{'Array.fills':aliases},'textures':{'Array.colors':['Texture.default']*5+['Texture.v5','Texture.v6','Texture.v7']}},
  'geometry':f'Array.fills[({level}-1)*5+({variant}<5?{variant}:0)]','materials':[{'*':'Material.default'}],
  'textures':[f'Array.colors[{variant}]']}
 desc['render_controllers'].append({rc:"q.property('"+NS+"ready') && q.property('"+NS+"mode') == 2"})
 pending_assets(controllers,desc,geometries)
 out(RP/'models/entity/a2770_placed/seasoning.geo.json',{'format_version':'1.16.0','minecraft:geometry':geometries})
 out(RP/'entity/a2770_placed_seasoning.entity.json',{'format_version':'1.10.0','minecraft:client_entity':{'description':desc}})
 properties={'mode':[0,2],'fill':[0,8],'variant':[0,7],**{f'layer_{n}':[0,9] for n in range(8)}}
 out(BP/'entities/a2770_placed_seasoning.json',entity(desc['identifier'],properties))
 return len(geometries)+1

def oil_assets(controllers):
 path=VENDOR/'cookery_oil_pot.json'
 if not path.is_file():
  assert ALLOW_FETCH,'missing pinned Cookery base model'
  response=json.loads(download('https://api.github.com/repos/KaleidoscopeMods/KaleidoscopeCookery/git/blobs/'+COOKERY_MODEL))
  data=base64.b64decode(response['content']);assert blob(data)==COOKERY_MODEL
  path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
 data=path.read_bytes();assert blob(data)==COOKERY_MODEL;SOURCES['cookery_oil_pot.json']=COOKERY_MODEL
 base=json.loads(data);assert len(base['elements'])==7
 textures={};geometry=None
 for kind,name in [('canola','oil_pot_canola'),('chili','oil_pot_secret_chili'),('glow','oil_pot_premium_glow')]:
  image=Image.open(io.BytesIO(source('kaleidoscope_grilling/textures/block/'+name+'.png'))).convert('RGBA')
  g,atlas=convert(base,'geometry.kg_a2770.oil_skin',image_override=image,inflate=.01)
  if geometry is None:geometry=g
  else:assert g==geometry
  textures[kind]='textures/a2770_placed/'+name
  out(RP/('textures/a2770_placed/'+name+'.png'),png(atlas))
 glow=deepcopy(geometry);glow['description']['identifier']='geometry.kg_a2770.oil_glow'
 for cube in glow['bones'][0]['cubes']:cube['inflate']=.02
 out(RP/'models/entity/a2770_placed/oil.geo.json',{'format_version':'1.16.0','minecraft:geometry':[geometry,glow]})
 desc={'identifier':NS+'placed_oil_visual','materials':{'default':'entity_alphatest','glow':'entity_emissive_alpha'},
  'textures':textures,'geometry':{'default':geometry['description']['identifier'],'glow':glow['description']['identifier']},
  'render_controllers':[
   {'controller.render.kg_a2770.oil':"q.property('"+NS+"ready') && q.property('"+NS+"oil') > 0"},
   {'controller.render.kg_a2770.oil_glow':"q.property('"+NS+"ready') && q.property('"+NS+"oil') == 3"}]}
 controllers['controller.render.kg_a2770.oil']={'arrays':{'textures':{'Array.oils':['Texture.canola','Texture.canola','Texture.chili','Texture.chili']}},
  'geometry':'Geometry.default','materials':[{'*':'Material.default'}],'textures':["Array.oils[q.property('"+NS+"oil')]"]}
 controllers['controller.render.kg_a2770.oil_glow']={'geometry':'Geometry.glow','materials':[{'*':'Material.glow'}],'textures':['Texture.glow']}
 out(RP/'entity/a2770_placed_oil.entity.json',{'format_version':'1.10.0','minecraft:client_entity':{'description':desc}})
 out(BP/'entities/a2770_placed_oil.json',entity(desc['identifier'],{'oil':[0,3]}))

def ingredient_palette():
 atlas=load(RP/'textures/item_texture.json')['texture_data'];result={}
 # Bottle/skewer GUI renders are presentation assets, never particle-color sources.
 # Match item identity rather than mutable icon keys, including fill proxies.
 bottles={NS+name for name in ('empty_seasoning_bottle','pending_seasoning','special_seasoning')}
 bottles|={NS+f'special_seasoning_r{r}_v{v}' for r in range(1,9) for v in range(8)}
 bottles|={NS+f'{state}_seasoning_f{fill}' for state in ('partial','pending') for fill in range(1,9)}
 skewers={NS+'unfinished_skewer',NS+'secret_skewer'}
 profiles=json.loads(re.search(r'PROFILE_BY_ITEM=Object.freeze\((\{.*?\})\)',(BP/'scripts/data.js').read_text()).group(1))
 # PR124's owned duration aliases reuse the canonical Java item texture.
 # They are not additional seasoning ingredients or Java palette identities.
 aliases={identifier+'_java_three_alt' for identifier,profile in profiles.items() if profile=='THREE_RANDOM'}|{'kaleidoscope_grilling:secret_skewer_java_three_alt'}
 aliases|={identifier+'_native_plain' for identifier in {*profiles,'kaleidoscope_grilling:secret_skewer'}}
 # G121 quality variants reuse their canonical dish icons and visual indices.
 # They are native nutrition identities, not additional seasoning palette items.
 aliases|={NS+f'{name}_cuisine_q{quality}' for name in (
  'houttuynia_stir_fried_pork','green_pepper_squid_tentacles','braised_chicken_wings') for quality in range(4)}
 for file in sorted((BP/'items').glob('*.json')):
  item=load(file)['minecraft:item']
  if item['description']['identifier'] in aliases:continue
  icon=item.get('components',{}).get('minecraft:icon')
  key=icon if isinstance(icon,str) else (icon or {}).get('texture',(icon or {}).get('textures',{}).get('default'))
  # Native GUI routing changes neither Java particle colors nor old tint indices.
  native_name=item['description']['identifier'].removeprefix(NS)
  if icon is None and native_name in ('grilled_slime_skewer','mysterious_skewer'):
   from native_skewer_icons import check_or_write
   check_or_write(ROOT)
   key=native_name
  if item['description']['identifier'] in bottles:
   candidate=RP/'textures/blocks/seasoning_bottle.png'
  elif item['description']['identifier'] in skewers:
   # Java's model particle texture remains the shaft UV; the separate GUI
   # compositor must not change seasoning colors or reorder their tint slots.
   candidate=RP/'textures/secret_skewer_stick.png'
  else:
   paths=atlas.get(key,{}).get('textures');path=paths[0] if isinstance(paths,list) else paths
   if not isinstance(path,str):continue
   candidate=RP/(path if path.endswith('.png') else path+'.png')
  if not candidate.is_file():continue
  image=Image.open(candidate).convert('RGBA');w,h=image.size
  colors=Counter((r<<16)|(g<<8)|b for r,g,b,a in image.crop((w//4,h//4,3*w//4,3*h//4)).getdata() if a>=48)
  top=[color for color,count in colors.most_common(2)]
  if not top:continue
  if len(top)==1:
   rgb=top[0];top.append((int(((rgb>>16)&255)*.78)<<16)|(int(((rgb>>8)&255)*.78)<<8)|int((rgb&255)*.78))
  result[item['description']['identifier']]=top
 # GUI icons can be rebaked independently from Java's particle sprites.
 # The eight supported bottle ingredients use release-pinned particle samples,
 # including vanilla ingredients absent from this pack's local item atlas.
 pinned=load(ROOT/'development/gameplay_core/fixtures/java-seasoning-colors-1.1.1.json')
 assert pinned['source_commit']==JAVA
 for identifier,row in pinned['ingredients'].items():result[identifier]=row['rgb']
 return result

def build():
 global TINT_VALUES
 palette=ingredient_palette()
 TINT_VALUES=sorted({0xB86B45,0xE0A56A,*[color for pair in palette.values() for color in pair]})
 controllers={};count=seasoning_assets(controllers);oil_assets(controllers)
 out(RP/'render_controllers/a2770_placed.render_controllers.json',{'format_version':'1.8.0','render_controllers':controllers})
 out(BP/'scripts/a2770_placed_visual_data.js',('export const INGREDIENT_COLORS=Object.freeze('+json.dumps(palette,ensure_ascii=False,sort_keys=True)+');\nexport const PLACED_TINT_INDEX=Object.freeze('+json.dumps({rgb:i for i,rgb in enumerate(TINT_VALUES)},sort_keys=True)+');\n').encode())
 source_index={'grilling_commit':JAVA,'cookery_model_blob':COOKERY_MODEL,'sources':SOURCES,
  'pending_palette_method':'Java center-half top-two colors for locally available item textures; Java fallback pair otherwise',
  'pending_live_resource_pack_sampling':False,'pending_palette_tiles':len(TINT_VALUES),'pending_tint_mode':'single-pass static opaque palette UVs','seasoning_geometry_count':count,
  'oil_overlay_inflate_model_units':[.01,.02]}
 out(VENDOR/'sources.json',source_index)
 return source_index

def assert_generated(actual,expected,path):
 if not path.endswith('.png'):
  assert actual==expected,('generated source drift',path)
  return
 # Different OS zlib encoders can emit different streams for identical pixels.
 # Validate CRC/format, dimensions, RGBA mode and every channel (including alpha).
 images=[]
 for raw in (actual,expected):
  with Image.open(io.BytesIO(raw)) as check:
   assert check.format=='PNG' and check.mode=='RGBA',('unexpected generated PNG format',path)
   check.verify()
  with Image.open(io.BytesIO(raw)) as image:
   image.load();images.append((image.size,image.mode,image.tobytes()))
 assert images[0]==images[1],('generated PNG pixel drift',path)

def equivalence_regression():
 # Pure image-data checks, not Minecraft rendering or player simulation.
 image=Image.new('RGBA',(4,4),(120,70,30,180))
 raw=[]
 for level in (0,9):
  stream=io.BytesIO();image.save(stream,format='PNG',compress_level=level);raw.append(stream.getvalue())
 assert raw[0]!=raw[1];assert_generated(raw[0],raw[1],'test.png')
 image.putpixel((0,0),(120,70,30,179));stream=io.BytesIO();image.save(stream,format='PNG')
 try:assert_generated(raw[0],stream.getvalue(),'test.png')
 except AssertionError:pass
 else:raise AssertionError('PNG checker failed to reject alpha drift')
 try:assert_generated(b'old',b'new','test.json')
 except AssertionError:pass
 else:raise AssertionError('source checker failed to reject text drift')

def main():
 global ALLOW_FETCH
 parser=argparse.ArgumentParser();parser.add_argument('--install',action='store_true');parser.add_argument('--fetch-sources',action='store_true');parser.add_argument('--check',action='store_true');args=parser.parse_args()
 if args.install:raise RuntimeError('Retired one-shot installer; A2.8 integration owns manifests and runtime wiring')
 ALLOW_FETCH=args.fetch_sources
 report=build()
 if args.check:
  equivalence_regression()
  for path,data in OUT.items():assert_generated((ROOT/path).read_bytes(),data,path)
 else:
  for path,data in OUT.items():
   target=ROOT/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
 print(json.dumps({'generated_files':len(OUT),'source_files':len(SOURCES),**report},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
