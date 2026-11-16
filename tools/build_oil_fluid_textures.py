"""Bake Java 1.21.1 fluid tints and animation metadata into existing oil assets.

The client archive is data only and is never executed or copied into the repo.
Source: KaleidoscopeGrilling 9a1acdab ClientSetup.registerFluidExtensions.
"""
import argparse,hashlib,io,json,zipfile
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
CLIENT_SHA1='30c73b1c5da787909b2f73340419fdf13b9def88'
OILS={'canola':('water',(192,138,36)),'secret_chili':('water',(224,75,42)),'premium_chili':('lava',(158,27,22))}

def outputs(archive):
    data=Path(archive).read_bytes()
    if hashlib.sha1(data).hexdigest()!=CLIENT_SHA1:raise ValueError('Expected the official Java 1.21.1 client archive')
    rp=ROOT/'projects/grilling/gameplay_core/resource_pack';planned={}
    flips=json.loads((rp/'textures/flipbook_textures.json').read_text())
    with zipfile.ZipFile(io.BytesIO(data))as z:
        for oil,(fluid,tint)in OILS.items():
            for kind in ['still','flow']:
                stem=f'assets/minecraft/textures/block/{fluid}_{kind}'
                source=Image.open(io.BytesIO(z.read(stem+'.png'))).convert('RGBA')
                metadata=json.loads(z.read(stem+'.png.mcmeta'))['animation']
                # Integer RGB multiplication matches the existing Java-color bake
                # convention. Preserve source alpha, resolution, order and pixels.
                image=Image.new('RGBA',source.size)
                image.putdata([tuple(pixel[i]*tint[i]//255 for i in range(3))+(pixel[3],)for pixel in source.getdata()])
                for suffix,part in [('',image),('_first',image.crop((0,0,image.width,image.width)))]:
                    buffer=io.BytesIO();part.save(buffer,format='PNG');planned[rp/f'textures/blocks/java_oil/{oil}_{kind}{suffix}.png']=buffer.getvalue()
                tile=f'kg_a23_{oil}_oil'+('_flow'if kind=='flow'else'')
                entries=[row for row in flips if row.get('atlas_tile')==tile]
                if len(entries)!=1:raise ValueError('Expected one existing flipbook for '+tile)
                row=entries[0];row['ticks_per_frame']=metadata.get('frametime',1)
                if 'frames'in metadata:row['frames']=metadata['frames']
                else:row.pop('frames',None)
                row.pop('blend_frames',None)
                if metadata.get('interpolate'):row['blend_frames']=True
                # Existing flow replication and atlas names remain unchanged.
    planned[rp/'textures/flipbook_textures.json']=(json.dumps(flips,indent=2)+'\n').encode()
    return planned

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--java-client',required=True,type=Path);parser.add_argument('--write',action='store_true');args=parser.parse_args()
    drift=[]
    for path,expected in outputs(args.java_client).items():
        if not path.exists()or path.read_bytes()!=expected:
            if args.write:path.write_bytes(expected)
            else:drift.append(str(path.relative_to(ROOT)))
    if drift:raise SystemExit('Oil fluid source drift: '+', '.join(drift))
    print('Six Java tinted sheets, six first frames and existing flipbooks match; no engine acceptance claimed')
if __name__=='__main__':main()
