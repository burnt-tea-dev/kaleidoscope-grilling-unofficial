"""Canonical 25-tick vanilla-use variants for the Java animation-off option."""
from pathlib import Path
import argparse,copy,json,re
ROOT=Path(__file__).resolve().parents[1]
BP=ROOT/'projects/grilling/gameplay_core/behavior_pack'
SUFFIX='_native_plain'
def build():
    profiles=json.loads(re.search(r'PROFILE_BY_ITEM=Object.freeze\((\{.*?\})\)',(BP/'scripts/data.js').read_text()).group(1))
    ids=set(profiles)|{'kaleidoscope_grilling:secret_skewer'}
    outputs={}
    for identifier in sorted(ids):
        name=identifier.split(':')[1];src=BP/'items'/f'{name}.json';doc=json.loads(src.read_text())
        tags=doc['minecraft:item']['components'].setdefault('minecraft:tags',{'tags':[]})['tags'];tag='kaleidoscope_grilling:food_'+name
        if tag not in tags:tags.append(tag)
        outputs[src]=doc
        plain=copy.deepcopy(doc);item=plain['minecraft:item'];item['description']['identifier']=identifier+SUFFIX;item['description'].pop('menu_category',None)
        item['components']['minecraft:use_modifiers']['use_duration']=1.25
        item['components']['minecraft:use_animation']={'value':'eat'}
        # Native arbitration probe: public ONE only; keep its plain control unchanged.
        if identifier=='kaleidoscope_grilling:grilled_caterpillar_skewer':
            doc['minecraft:item']['components']['minecraft:use_modifiers']['start_using']='if_first'
            item['components']['minecraft:use_modifiers']['start_using']='always'
        outputs[BP/'items'/f'{name}{SUFFIX}.json']=plain
    def ingredients(value):
        if isinstance(value,dict):
            if value.get('item') in ids:value['tag']='kaleidoscope_grilling:food_'+value.pop('item').split(':')[1]
            for key,row in value.items():
                if key!='result':ingredients(row)
        elif isinstance(value,list):
            for row in value:ingredients(row)
    for src in (BP/'recipes').rglob('*.json'):
        doc=json.loads(src.read_text());before=copy.deepcopy(doc);ingredients(doc)
        if doc!=before:outputs[src]=doc
    return outputs
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    for path,doc in build().items():
        content=json.dumps(doc,ensure_ascii=False,indent=2)+'\n'
        if args.check:assert path.read_text()==content,path
        else:path.write_text(content)
    print('Native vanilla-use variants: 25 ticks; metadata and food components preserved')
