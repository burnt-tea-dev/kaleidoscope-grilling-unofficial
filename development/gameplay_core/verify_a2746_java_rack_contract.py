from __future__ import annotations
import hashlib,json,re,urllib.request
from pathlib import Path
BASE='https://raw.githubusercontent.com/breezeth-CN/KaleidoscopeGrilling/9a1acdab27698457bec16c9362678e574895a28c/'
FILES={
 'entity':('neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/rack/AdvancedRackBlockEntity.java','ac52b331e020d2020964da754c8fdeec47cd1c52',(
  'COMPARTMENT_COUNT = 9','depositMatching(ServerPlayer player)','swapWithHotbar(ServerPlayer player, int compartment)',
  'Math.min(4, occupied)','OilPotCompat.isOilPot','isSeasoningBottle','MEMORY_TAG')),
 'menu':('neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/rack/AdvancedRackMenu.java','a49b63c412a4d26c43be055f958a76115568e61b',(
  'DEPOSIT_BUTTON = 9','AdvancedRackBlockEntity.COMPARTMENT_COUNT','clearFilter(slotId)','swapWithHotbar(serverPlayer, id)','depositMatching(serverPlayer)')),
 'block':('neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/rack/AdvancedRackBlock.java','bcbd48401f08534cba33bdda96c6d37c29efead1',(
  'IntegerProperty.create("spice_level", 0, 4)','DataComponents.BLOCK_ENTITY_DATA','DataComponents.CONTAINER')),
 'compat':('neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/AdvancedRackCompatApi.java','a27032bf1c8e852f0afdf584fc00d9b1daadf828',(
  'slot < 5 ? isSeasoningItem(stack) : isToolItem(stack)','advanced_rack_seasonings','advanced_rack_tools')),
 'automation':('neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/AdvancedRackAutomationApi.java','58f3e6f9f9dcef5a237e2c39bce6e7170b1afed6',(
  'BorrowReceipt','BorrowResult','returnBorrowed','simulate')),
 'grill':('neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/grill/GrillBlock.java','b41c563e6e0ef9d2fc76b45628a50e3ae11fe862',(
  'private static final VoxelShape FLAT_Z','private static final VoxelShape FLAT_X',
  'return s.getValue(LEGGED) ? (x ? LEGS_X : LEGS_Z) : (x ? FLAT_X : FLAT_Z);')),
 'blocks':('neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModBlocks.java','69f91d7c18ecfa14c206b910d2d4e1d92ce9f6d0',(
  'BlockBehaviour.Properties.ofLegacyCopy(Blocks.IRON_BARS)',
  'BlockBehaviour.Properties.ofFullCopy(Blocks.OAK_SLAB)')),
}
def blob(v):return hashlib.sha1(b'blob '+str(len(v)).encode()+bytes([0])+v).hexdigest()
def check_collision_source(name,path,data,witness):
 source_name={'block':'AdvancedRackBlock','grill':'GrillBlock','blocks':'ModBlocks'}.get(name)
 if source_name:
  assert witness['sources'][source_name]['path']==path
  assert witness['sources'][source_name]['sha256']==hashlib.sha256(data).hexdigest()
 if name in ('block','grill'):
  boxes={key.lower():[float(x.strip()) for x in raw.split(',')]
         for key,raw in re.findall(r'VoxelShape\s+(\w+)\s*=\s*Block\.box\(([^)]+)\)',data.decode())}
  expected={f:boxes[f] for f in ('north','south','east','west')} if name=='block' else {
   'north':boxes['flat_z'],'south':boxes['flat_z'],'east':boxes['flat_x'],'west':boxes['flat_x']}
  assert witness['shape_bounds']['advanced_rack' if name=='block' else 'grill']==expected
def main():
 witness=json.loads((Path(__file__).resolve().parents[2]/'data/java-collision-shapes-20261016.json').read_text())
 for name,(path,sha,tokens) in FILES.items():
  req=urllib.request.Request(BASE+path,headers={'User-Agent':'Grilling-A2.7.46-contract/1'})
  with urllib.request.urlopen(req,timeout=90) as r:data=r.read()
  assert blob(data)==sha,(name,blob(data),sha);s=data.decode()
  for token in tokens:assert token in s,(name,token)
  check_collision_source(name,path,data,witness)
 print('A2.7.46 pinned Java Advanced Rack contract: PASS')
if __name__=='__main__':main()
