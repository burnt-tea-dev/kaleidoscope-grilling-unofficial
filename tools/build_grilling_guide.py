"""Build the Cookery-style encyclopedia from the editable A3 catalog.

No historical augmenter, host UI override or gameplay mutation is involved.
"""
from __future__ import annotations
import argparse, hashlib, json, re
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'projects/grilling/guide/catalog.a3.json'
PROJECT=ROOT/'projects/grilling/gameplay_core'
BP,RP=PROJECT/'behavior_pack',PROJECT/'resource_pack'
LOCALES=('zh_CN','zh_TW','en_US')
# Public Cookery localizes its known station names. Unknown methods remain
# canonical English; their localized steps are in mechanicsByLocale. API v1
# does not accept per-locale recipe methods, so do not invent unsupported fields.
METHOD_LABELS={'Crafting':'Crafting Table'}
EXTERNAL_ICONS={'textures/items/redstone_dust','textures/items/gunpowder','textures/items/kc_oil_pot_filled'}
ID=re.compile(r'^[a-z0-9_.-]+:[a-z0-9_./-]+$')

def load(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def units(text):return len(text.encode('utf-16-le'))//2

def validate_source(s):
    if s.get('schema_version')!=3 or s.get('module_id')!='kg_a1:grilling':raise ValueError('Wrong catalog schema/module')
    if s['locales']!=list(LOCALES) or s['fallback_locale']!='zh_TW':raise ValueError('Locale contract drift')
    # ActionForm icons are full PNGs, not block UVs or multi-item atlases.
    bad={'textures/ui/kg_grilling/guide_grill','textures/ui/kg_grilling/guide_seasoning'}
    icons=[s['icon'],*[row['icon'] for row in s['categories']],*[row['icon'] for row in s['entries']]]
    if any(icon in bad for icon in icons):raise ValueError('Raw material atlas used as a guide icon')
    cats={c['id']:c for c in s['categories']}
    if len(cats)!=len(s['categories']) or not 1<=len(cats)<=32:raise ValueError('Category IDs/count')
    parents={c['parent'] for c in cats.values() if c.get('parent')}
    for c in cats.values():
        if c.get('parent') and (c['parent'] not in cats or cats[c['parent']].get('parent')):raise ValueError('Host supports only one child layer')
        if set(c['title'])!=set(LOCALES):raise ValueError('Category locale coverage')
    entries=s['entries'];ids=[e['id'] for e in entries]
    if len(ids)!=len(set(ids)) or not 1<=len(ids)<=1024:raise ValueError('Duplicate/invalid entry count')
    counts=Counter()
    for e in entries:
        if not ID.fullmatch(e['id']):raise ValueError('Invalid entry ID '+e['id'])
        if not 1<=len(e['categories'])<=8 or len(set(e['categories']))!=len(e['categories']):raise ValueError('Entry membership')
        for c in e['categories']:
            if c not in cats or c in parents:raise ValueError('Unreachable entry under parent '+e['id'])
            counts[c]+=1
        if set(e['title'])!=set(LOCALES) or set(e['body'])!=set(LOCALES):raise ValueError('Entry locale coverage')
        if len(set(e['kinds'])-{'item','block'}):raise ValueError('Unsupported kind')
        if e.get('food') and e['food']['nutrition']<=0:raise ValueError('Interaction hook/dynamic nutrition must not become a zero-food stat')
        for l in LOCALES:
            if not 1<=len(e['body'][l])<=8:raise ValueError('Host mechanics budget '+e['id'])
            if any(not isinstance(x,str) or not x.strip() or units(x)>512 for x in e['body'][l]):raise ValueError('Host would truncate mechanics '+e['id'])
            if e['title'][l]==e['id']:raise ValueError('Untranslated entry '+e['id'])
        if len(e.get('recipes',[]))>24:raise ValueError('Host recipe budget')
        for r in e.get('recipes',[]):
            if not r['method'] or units(METHOD_LABELS.get(r['method'],r['method']))>64:raise ValueError('Recipe label')
            if not 1<=len(r['ingredients'])<=12:raise ValueError('Ingredient budget')
            if not 1<=r['count']<=64 or not 0<=r['time']<=72000:raise ValueError('Recipe count/time')
            for iid in [*r['ingredients'],r['result']]:
                if not ID.fullmatch(iid) or any(iid not in s['names'][l] for l in LOCALES):raise ValueError('Recipe name missing '+iid)
        for ref in e.get('source_refs',[]):
            if not (ROOT/ref.split('#')[0]).is_file():raise ValueError('Missing source evidence '+ref)
    for cid in cats:
        if cid not in parents and not counts[cid]:raise ValueError('Empty menu '+cid)
    for target,row in s['icon_sources'].items():
        if not target.startswith('textures/ui/kg_grilling/catalog/') or '..' in target:raise ValueError('Icon target escape')
        src=ROOT/row['source']
        if not src.is_file() or hashlib.sha256(src.read_bytes()).hexdigest()!=row['sha256']:raise ValueError('Item icon source drift '+target)
    for row in [*s['categories'],*entries]:
        icon=row['icon']
        if icon not in s['icon_sources'] and icon not in EXTERNAL_ICONS and not (RP/(icon+'.png')).is_file():raise ValueError('Unresolved guide icon '+icon)
    return counts

def build_payload(s):
    out={'api':1,'id':s['module_id'],'version':s['version'],'order':s['order'],'icon':s['icon'],
         'titleKey':'title','introKey':'intro','allKey':'all','selectKey':'select','backKey':'back','languageNoteKey':'language_note',
         'showAll':False,'showIds':False,'showKinds':False,'showCategoryOnEntry':False,
         'categories':[],'entries':[],'names':s['names'],'text':{l:dict(s['ui'][l]) for l in LOCALES}}
    for c in s['categories']:
        row={'id':c['id'],'labelKey':c['id'],'fallback':c['title']['en_US'],'icon':c['icon']}
        if c.get('parent'):row['parent']=c['parent']
        out['categories'].append(row)
        for l in LOCALES:out['text'][l][c['id']]=c['title'][l]
    for e in s['entries']:
        row={k:e[k] for k in ('id','icon','kinds','categories')}
        row['category']=e['categories'][0]
        row['mechanics']=e['body']['zh_TW'];row['mechanicsByLocale']=e['body']
        for k in ('stack','food'):
            if k in e:row[k]=e[k]
        row['recipes']=[{**r,'method':METHOD_LABELS.get(r['method'],r['method'])} for r in e.get('recipes',[])]
        out['entries'].append(row)
    return out

def lang_text(s,l):
    esc=lambda v:str(v).replace('\n','\\n').replace('\r','')
    rows=[f'guide.kg.{k}={esc(v)}' for k,v in s['ui'][l].items()]
    rows += [f'guide.kg.category.{c["id"]}={esc(c["title"][l])}' for c in s['categories']]
    for e in s['entries']:
        rows.append(f'guide.kg.name.{e["id"]}={esc(e["title"][l])}')
        rows += [f'guide.kg.body.{e["id"]}.{i}={esc(v)}' for i,v in enumerate(e['body'][l],1)]
    return '\n'.join(rows)+'\n'

LANG_BEGIN='## BEGIN GRILLING GUIDE A3 (generated)'
LANG_END='## END GRILLING GUIDE A3 (generated)'
def merged_lang(path,guide_text):
    text=path.read_bytes().decode('utf-8-sig') if path.exists() else ''
    if LANG_BEGIN in text or LANG_END in text:
        if text.count(LANG_BEGIN)!=1 or text.count(LANG_END)!=1:raise ValueError('Guide language markers are malformed')
        prefix,rest=text.split(LANG_BEGIN,1);_old,suffix=rest.split(LANG_END,1)
        if suffix.strip():raise ValueError('Do not append gameplay text inside/after the generated guide section')
        text=prefix
    if any(line.startswith('guide.kg.') for line in text.splitlines()):raise ValueError('Duplicate unmanaged guide language keys')
    return text.rstrip('\r\n')+'\n\n'+LANG_BEGIN+'\n'+guide_text+LANG_END+'\n'

def write_or_check(p,b,check):
    if isinstance(b,str):b=b.encode('utf-8')
    if check:
        if not p.is_file() or p.read_bytes()!=b:raise ValueError('Generated output drift: '+str(p.relative_to(ROOT)))
    else:p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--check',action='store_true');a=ap.parse_args()
    s=load(SOURCE);counts=validate_source(s);p=build_payload(s)
    raw=json.dumps(p,ensure_ascii=True,separators=(',',':'))
    chunks=(len(raw)+1599)//1600
    if chunks>512:raise ValueError('Host transfer capacity exceeded')
    write_or_check(BP/'scripts/guide/payload.js','export const GUIDE_PAYLOAD='+json.dumps(p,ensure_ascii=False,separators=(',',':'))+';\n',a.check)
    for l in LOCALES:write_or_check(RP/'texts'/f'{l}.lang',merged_lang(RP/'texts'/f'{l}.lang',lang_text(s,l)),a.check)
    for target,row in s['icon_sources'].items():write_or_check(RP/(target+'.png'),(ROOT/row['source']).read_bytes(),a.check)
    print(json.dumps({'guide_version':s['version'],'entries':len(p['entries']),'root_categories':len([c for c in s['categories'] if not c.get('parent')]),'child_categories':len([c for c in s['categories'] if c.get('parent')]),'category_memberships':dict(counts),'recipes':sum(len(e['recipes']) for e in p['entries']),'item_icons':len(s['icon_sources']),'transfer_chunks':chunks,'acquisition_gaps':len(s['acquisition_gaps']),'mode':'check' if a.check else 'write'},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
