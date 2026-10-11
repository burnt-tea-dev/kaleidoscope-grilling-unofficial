"""Exact RGBA atlas of the pinned Java eating progress PNGs.

Original art: breezeth / Kaleidoscope Official Production Team, CC-BY-NC-SA-4.0.
No resampling, tinting, masking, alpha compositing, padding or material change.
"""
import hashlib
from io import BytesIO
import struct
import zlib
from PIL import Image

ATLAS_REL='textures/ui/kg_java/skewer_eating_progress_atlas.png'
SOURCE_PINS={
 'yellow':'5dac33d46a4c77efef31ce753e0a006b9e176be80dfb465217f390cddd021f5e',
 'green':'9fab4371af32f52557e57220fbcf5034d30251b2976e6c6c83d11fa4634b2561',
}

def build_progress_atlas(yellow_bytes,green_bytes):
    atlas=Image.new('RGBA',(204,5))
    for x,color,data in [(0,'yellow',yellow_bytes),(102,'green',green_bytes)]:
        if hashlib.sha256(data).hexdigest()!=SOURCE_PINS[color]:
            raise ValueError('Pinned original '+color+' progress PNG required')
        with Image.open(BytesIO(data)) as image:
            if image.mode!='RGBA' or image.size!=(102,5):
                raise ValueError('Expected original 102x5 RGBA progress image')
            if any(k in image.info for k in ('gamma','srgb','icc_profile','transparency')):
                raise ValueError('Unexpected source color or transparency metadata')
            atlas.paste(image,(x,0)) # No mask: preserve all four channels exactly.
    # Same fixed uncompressed-PNG pattern already used by build_skewer_inventory_icons.
    pixels=atlas.tobytes();stride=204*4
    raw=b''.join(b'\0'+pixels[y*stride:(y+1)*stride] for y in range(5))
    packed=(b'\x78\x01\x01'+struct.pack('<HH',len(raw),len(raw)^0xffff)
            +raw+struct.pack('>I',zlib.adler32(raw)&0xffffffff))
    def chunk(kind,data):
        return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    return (b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',204,5,8,6,0,0,0))
            +chunk(b'IDAT',packed)+chunk(b'IEND',b''))

def atlas_metadata(data):
    return {'sha256':hashlib.sha256(data).hexdigest(),'kind':'lossless_rgba_sprite_atlas',
            'size':[204,5],'regions':{'yellow':[0,0,102,5],'green':[102,0,102,5]},
            'source_sha256':SOURCE_PINS.copy(),'sampling':'bilinear false; integer pixel uv/uv_size'}
