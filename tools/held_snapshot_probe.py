"""Build only the isolated C-1 test pack from canonical display assets.

This is not an export/release path. Formal runtime and baseline stay unchanged.
The test entry imports real plate planning and metadata modules, not main.js.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import zipfile
import uuid

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'projects/grilling/gameplay_core'
FIXTURE=ROOT/'tests/native/held-snapshot'
# Keep the Mojang input external: its EULA is not this project's license.
PLAYER_TEMPLATE_URL='https://raw.githubusercontent.com/Mojang/bedrock-samples/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/entity/player.entity.json'
PLAYER_TEMPLATE_SHA256='7e520d872fc72be266223b3db2883c2818742a9a450330753a6de4d2ad813608'
def protocol():
    snapshot=(FIXTURE/'scripts/snapshot.js').as_uri()
    transport=(SOURCE/'behavior_pack/scripts/held_visual_transport.js').as_uri()
    script='import * as s from '+json.dumps(snapshot)+';import {heldVisualPropertyNames} from '+json.dumps(transport)+';'
    script+="const fields=Object.fromEntries(['main','off'].flatMap(hand=>heldVisualPropertyNames(hand).map((name,i)=>[name.split(':')[1],s.variableName(hand,i)])));"
    script+='process.stdout.write(JSON.stringify({fields,frame:s.FRAME_PROPERTY,max:s.FRAME_MAX,frameVariable:s.FRAME_VARIABLE,animation:s.SNAPSHOT_ANIMATION,controller:s.SNAPSHOT_CONTROLLER}));'
    return json.loads(subprocess.check_output(['node','--input-type=module','-e',script],text=True))

PROTOCOL=protocol()
FRAME=PROTOCOL['frame']
FIELDS=PROTOCOL['fields']
READ=re.compile(r"((?:c\.owning_entity->)?(?:q|query))\.(property|has_property)\('kaleidoscope_grilling:("+'|'.join(FIELDS)+r")'\)")


def ready(owner):
    ref=owner.rsplit('q',1)[0] if owner.endswith('q') else owner[:-len('query')]
    return '('+owner+".has_property('"+FRAME+"') && "+owner+".property('"+FRAME+"') > 0 && ("+ref+PROTOCOL['frameVariable']+' ?? 0) == '+owner+".property('"+FRAME+"'))"

def readers(text):
    def replace(match):
        owner,operation,name=match.groups()
        if operation=='has_property':return ready(owner)
        scope='c.owning_entity->' if owner.startswith('c.') else ''
        return '('+ready(owner)+' ? ('+scope+FIELDS[name]+' ?? 0) : 0)'
    return READ.sub(replace,text)

def configure_player(player):
    description=player['minecraft:client_entity']['description']
    scripts=description['scripts']
    # Attachable arrow reads cross the player scope. Those variables must be
    # public on the owning client entity; a JS reader test cannot prove this.
    variables=[*FIELDS.values(),PROTOCOL['frameVariable']]
    names=[name.replace('v.','variable.',1) for name in variables]
    scripts.setdefault('variables',{}).update({name:'public' for name in names})
    scripts.setdefault('initialize',[]).extend(name+' = 0;' for name in names)
    description['animations'].update({PROTOCOL['animation']:PROTOCOL['animation'],PROTOCOL['controller']:PROTOCOL['controller']})
    return player

def build(output, player_template, control=False):
    template=Path(player_template).read_bytes()
    if hashlib.sha256(template).hexdigest()!=PLAYER_TEMPLATE_SHA256:
        raise ValueError('Use the pinned official player template: '+PLAYER_TEMPLATE_URL)
    output=Path(output).resolve()
    if output.exists():raise ValueError('Choose a new probe output directory')
    output.mkdir(parents=True)
    bp,rp=output/'BP',output/'RP'
    shutil.copytree(SOURCE/'resource_pack',rp)
    shutil.copytree(FIXTURE/'scripts',bp/'scripts')
    shutil.copy2(FIXTURE/'manifest.json',bp/'manifest.json')
    shutil.copy2(FIXTURE/'resource-manifest.json',rp/'manifest.json')
    (bp/'scripts/mode.js').write_text('export const PROPERTY_CONTROL='+('true' if control else 'false')+';\n')
    if control:
        for path in (bp/'manifest.json',rp/'manifest.json'):
            manifest=json.loads(path.read_text())
            for node in [manifest['header'],*manifest['modules'],*manifest.get('dependencies',[])]:
                if 'uuid' in node:node['uuid']=str(uuid.uuid5(uuid.UUID(node['uuid']),'property-control'))
            manifest['header']['name']+=' [28-property positive control]'
            path.write_text(json.dumps(manifest,indent=2)+'\n')
    # Copy the real import closure. No source text is executed or sliced here.
    queue=['plate_held_visual_core.js','core/player_props.js','core/persist.js']
    copied=set()
    while queue:
        relative=queue.pop()
        if relative in copied:continue
        path=SOURCE/'behavior_pack/scripts'/relative
        if not path.is_file():raise ValueError('Missing canonical module '+relative)
        copied.add(relative);target=bp/'scripts/canonical'/relative;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,target)
        for specifier in re.findall(r"(?:from\s+|import\s*)['\"](\.[^'\"]+)['\"]",path.read_text()):
            dep=(path.parent/specifier).resolve().relative_to((SOURCE/'behavior_pack/scripts').resolve()).as_posix();queue.append(dep)
    player=json.loads((SOURCE/'behavior_pack/entities/player.json').read_text())
    props=player['minecraft:entity']['description']['properties']
    if not control:
        for name in FIELDS:props.pop('kaleidoscope_grilling:'+name)
    props[FRAME]={'type':'int','range':[0,PROTOCOL['max']],'default':0,'client_sync':True}
    assert len(props)==(28 if control else 4)
    (bp/'entities').mkdir();(bp/'entities/player.json').write_text(json.dumps(player,indent=2)+'\n')
    (bp/'items').mkdir()
    item=json.loads((SOURCE/'behavior_pack/items/skewer_plate.json').read_text())
    # This fixture tests holding, not meal settlement. Do not consume the test
    # plate through native food while the full gameplay entry is absent.
    for name in ('minecraft:food','minecraft:use_modifiers','minecraft:use_animation'):
        item['minecraft:item']['components'].pop(name,None)
    (bp/'items/skewer_plate.json').write_text(json.dumps(item,indent=2)+'\n')
    changed=[]
    for path in rp.rglob('*.json'):
        text=path.read_text();result=text if control else readers(text)
        if result!=text:path.write_text(result);changed.append(str(path.relative_to(rp)))
    carrier={'format_version':'1.8.0','animations':{PROTOCOL['animation']:{'loop':True,'animation_length':1,'bones':{}}}}
    (rp/'animations/snapshot_probe.animation.json').write_text(json.dumps(carrier,indent=2)+'\n')
    (rp/'animation_controllers').mkdir(exist_ok=True)
    controller={'format_version':'1.10.0','animation_controllers':{PROTOCOL['controller']:{'initial_state':'default','states':{'default':{}}}}}
    (rp/'animation_controllers/snapshot_probe.controller.json').write_text(json.dumps(controller,indent=2)+'\n')
    (rp/'entity/player.entity.json').write_text(json.dumps(configure_player(json.loads(template)),indent=2)+'\n')
    report={'scope':'C-1 isolated display prototype; not release/runtime migration','source_version':json.loads((ROOT/'baseline.json').read_text())['version'],'player_properties':len(props),'hand_words':24,'property_positive_control':control,'changed_resource_consumers':changed,'canonical_modules':sorted(copied),'player_template':{'url':PLAYER_TEMPLATE_URL,'sha256':PLAYER_TEMPLATE_SHA256},'client':False,'production_ready':False}
    (output/'build.json').write_text(json.dumps(report,indent=2)+'\n')
    archive=output/'held-snapshot-probe.mcaddon'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
        for folder in (bp,rp):
            for path in sorted(folder.rglob('*')):
                if path.is_file():z.write(path,path.relative_to(output))
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--player-template',type=Path,required=True);parser.add_argument('--control',action='store_true')
    args=parser.parse_args();print(json.dumps(build(args.output,args.player_template,args.control)))
