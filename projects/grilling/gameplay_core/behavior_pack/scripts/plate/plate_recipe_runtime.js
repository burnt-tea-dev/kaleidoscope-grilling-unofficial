import {onBlockInteraction} from '../core/events.js';
import {every} from '../core/scheduler.js';
import {grillingConfig} from '../server_config_runtime.js';
import {canonicalFoodId} from '../eating_profile_ids.js';
import {useSound} from '../immersion_audio_runtime.js';
import {itemTranslationKey} from '../hud/skewer_recipe_hud_core.js';
import {captureSkewerMetadata,restoreSkewerMetadata,metadataSignature} from '../skewer_item_snapshot.js';
import {decodePlateStorage,verifiedPlateStep,commitPlateSteps,plateFacingFromYaw} from '../plate_transaction_core.js';
import {nativeItemSignature,ownedItemStep,planOwnedInventoryDelivery,commitPlayerItemTransaction} from '../owned_item_transaction_core.js';
import {getItemProperty,setItemProperty,getItemPropertyIds,getItemLore,getItemRawLore,setItemLore} from '../itemData.js';
import {hasSolidTop,hasFullCubeCollision,hasSturdySide} from '../blockSupport.js';
import {withoutAutomaticCreatorLore} from '../skewer/hot_runtime.js';
import {creatorLore} from '../localized_lore_core.js';
import {queueStationContentsVisual} from '../station_contents_visual_queue.js';
import {interactionFeedback,interactionFailure,javaInteractionFeedback} from '../core/interaction_feedback.js';
import {world,system,ItemStack,EnchantmentType,BlockPermutation} from '@minecraft/server';
import {
 UNFINISHED_ID,SECRET_ID,SKEWER_INGREDIENTS_KEY,SECRET_COOKED_KEY,SECRET_COOKED_INGREDIENTS_KEY,SECRET_CREATOR_KEY,secretFood,recipeTable
} from '../skewer/skewering_core.js';
import {RAW_SKEWER_TAG,GRILLED_SKEWER_TAG} from '../skewer_compat_core.js';
import {
 PLATE_ID,PLATE_BLOCK_ID,BOOK_ID,RECIPE_BLOCK_ID,PLATE_SKEWERS_KEY,BOOK_RECORD_KEY,PLATE_CAPACITY,
 normalizePlateRows,plateAdd,plateRemoveLast,isRecordableRecipe,makeBookRecord,bookIngredientSlots,planInventoryConsumption
} from './plate_recipe_core.js';
import {playerInventory as mainContainer,getMainHand as heldMain,setMainHand as setMain,getOffHand as heldOff,setOffHand as setOff,getHand as heldByHand,setHand,isCreative as creative,captureWritableHand} from '../core/player_io.js';
import {isInitialBlockPress} from '../grill/grill_input_core.js';
import {stackIntentSignature as interactionStackSignature} from '../core/interaction_intent_core.js';
import {captureInteractionIntent,interactionIntentStillCurrent} from '../core/interaction_intent_adapter.js';

const COOKERY_RECIPE_ITEMS=new Set([
 'kaleidoscope_cookery:recipe_block',
 'kaleidoscope_cookery:recipe',
 'kaleidoscope_cookery:recipe_item'
]);
const COOKERY_TABLE='kaleidoscope_cookery:table';
const PLATE_PREFIX='kaleidoscope_grilling:a25_plate_';
const RECIPE_PREFIX='kaleidoscope_grilling:a25_recipe_';
const FIXED_IDS=new Set();
for(const r of recipeTable()){FIXED_IDS.add(r.id);if(r.cooked)FIXED_IDS.add(r.cooked)}
for(const id of ['kaleidoscope_grilling:mysterious_skewer','kaleidoscope_grilling:dark_grilling'])FIXED_IDS.add(id);

function enc(n){return n<0?'m'+Math.abs(n):'p'+n}
function posKey(prefix,block){return prefix+block.dimension.id.replace(/[^a-z0-9]/gi,'_')+'_'+enc(block.x)+'_'+enc(block.y)+'_'+enc(block.z)}
const message=interactionFeedback;
function cloneOne(stack){const out=stack.clone();out.amount=1;return out}
function decrementMain(player,count=1){
 if(creative(player))return true;const s=heldMain(player);if(!s||s.amount<count)return false;
 if(s.amount===count)setMain(player,undefined);else{s.amount-=count;setMain(player,s)}return true;
}
function decrementOff(player,count=1){
 if(creative(player))return true;const s=heldOff(player);if(!s||s.amount<count)return false;
 if(s.amount===count)setOff(player,undefined);else{s.amount-=count;setOff(player,s)}return true;
}
function decrementHand(player,hand,count=1){
 if(creative(player))return true;const s=heldByHand(player,hand);if(!s||s.amount<count)return false;
 if(s.amount===count)setHand(player,hand,undefined);else{s.amount-=count;setHand(player,hand,s)}return true;
}
function primitiveProps(stack){
 const out={};let ids=[];try{ids=getItemPropertyIds(stack)}catch{}
 for(const id of ids)try{
  const value=getItemProperty(stack,id);
  if(['string','number','boolean'].includes(typeof value))out[id]=value;
  else if(value&&typeof value==='object'&&Number.isFinite(value.x)&&Number.isFinite(value.y)&&Number.isFinite(value.z))out[id]={x:value.x,y:value.y,z:value.z};
 }catch{}
 return out;
}
function parseRowsProperty(stack,key,limit=5){
 try{
  const raw=getItemProperty(stack,key);if(typeof raw!=='string')return [];
  const rows=JSON.parse(raw);return Array.isArray(rows)?rows.filter(x=>x&&typeof x.id==='string').slice(0,limit):[];
 }catch{return []}
}
function skewerFood(stack){
 if(!stack)return {nutrition:0,saturation:0};
 if(canonicalFoodId(stack.typeId)===SECRET_ID){
  const rows=parseRowsProperty(stack,SKEWER_INGREDIENTS_KEY,3);
  let cooked=false;try{cooked=getItemProperty(stack,SECRET_COOKED_KEY)===true}catch{}
  const cookedRows=cooked?parseRowsProperty(stack,SECRET_COOKED_INGREDIENTS_KEY,3):[];
  return secretFood(cookedRows.length?cookedRows:rows,cooked,rows);
 }
 try{const food=stack.getComponent('minecraft:food');return {nutrition:Math.max(0,Number(food?.nutrition)||0),saturation:Math.max(0,Number(food?.saturationModifier)||0)}}catch{return {nutrition:0,saturation:0}}
}
function stackRow(stack){
 const food=skewerFood(stack),props=primitiveProps(stack);let lore=[],name='';
 try{lore=getItemLore(stack)}catch{}try{name=stack.nameTag??''}catch{}
 return {id:stack.typeId,native:captureSkewerMetadata(stack),nutrition:food.nutrition,saturation:food.saturation};
}
function restoreStack(row){
 if(!row||typeof row.id!=='string')return undefined;
 if(row.native&&row.native.id!==row.id)throw Error('Grilling: recorded identity mismatch');
 if(row.native)return restoreSkewerMetadata(row.native,(id,n)=>new ItemStack(id,n),id=>new EnchantmentType(id));
 const out=new ItemStack(row.id,1),props=row.props&&typeof row.props==='object'?row.props:{},lore=Array.isArray(row.lore)?row.lore:[];
 if(row.name)out.nameTag=row.name;setItemLore(out,lore);
 for(const [id,value] of Object.entries(props))setItemProperty(out,id,value);
 if((out.nameTag??'')!==(row.name??'')||JSON.stringify(getItemLore(out))!==JSON.stringify(lore))throw Error('Grilling: legacy skewer metadata readback differs');
 for(const [id,value] of Object.entries(props))if(JSON.stringify(getItemProperty(out,id))!==JSON.stringify(value))throw Error('Grilling: legacy skewer property readback differs');
 return out;
}
function isSkewer(stack){
 if(!stack)return false;
 if(FIXED_IDS.has(canonicalFoodId(stack.typeId))||canonicalFoodId(stack.typeId)===SECRET_ID)return true;
 try{return !!(stack.hasTag?.(RAW_SKEWER_TAG)||stack.hasTag?.(GRILLED_SKEWER_TAG))}catch{return false}
}
// Plate block-use and item-use callbacks are independent. Keep the Java
// SUCCESS/CONSUME gesture from also starting native eating, in either order.
function skewerUseTargetsPlate(player,stack){
 if(!isSkewer(stack))return false;
 try{
  if(player.isSneaking&&captureInteractionIntent(player,stack).hand==='off')return false;
  const hit=player.getBlockFromViewDirection?.({maxDistance:6,includePassableBlocks:true});
  if(hit?.block?.typeId!==PLATE_BLOCK_ID)return false;
  // SDK 2.9: faceLocation is block-relative; entity distance is ray-origin to
  // bounds. Compare the head ray's actual plate hit, not the block's center.
  const head=player.getHeadLocation?.(),face=hit.faceLocation,block=hit.block;
  if(!['x','y','z'].every(axis=>Number.isFinite(head?.[axis])&&Number.isFinite(face?.[axis])&&Number.isFinite(block[axis])))return false;
  const distance=Math.hypot(block.x+face.x-head.x,block.y+face.y-head.y,block.z+face.z-head.z);
  if(!Number.isFinite(distance)||distance<=0||distance>6)return false;
  const entities=player.getEntitiesFromViewDirection?.({maxDistance:distance,ignoreBlockCollision:true});
  // An entity in front, a tie or unreadable results cannot prove plate ownership.
  return Array.isArray(entities)&&entities.every(target=>target?.entity&&Number.isFinite(target.distance)&&target.distance>distance);
 }catch{return false}
}
function skewerIngredientIds(stack){return parseRowsProperty(stack,SKEWER_INGREDIENTS_KEY,3).map(x=>x.id)}
function isRecordableStack(stack){
 if(!stack)return false;const ingredients=skewerIngredientIds(stack);
 return isRecordableRecipe(stack.typeId,ingredients.length);
}
function plateRowsFromItem(stack){return normalizePlateRows(decodePlateStorage(getItemProperty(stack,PLATE_SKEWERS_KEY)))}
function plateItem(rows,template){
 const clean=normalizePlateRows(rows);let out;
 try{out=template?.typeId===PLATE_ID?cloneOne(template):new ItemStack(PLATE_ID,1)}catch{return undefined}
 let lore=[];try{lore=getItemRawLore(out).filter(x=>!(typeof x==='string'?x:x?.text??'').startsWith('§7Skewers:'))}catch{}
 lore.push('§7Skewers: '+clean.length+'/'+PLATE_CAPACITY);
 setItemLore(out,lore);const value=JSON.stringify(clean);setItemProperty(out,PLATE_SKEWERS_KEY,value);
 if(getItemProperty(out,PLATE_SKEWERS_KEY)!==value)throw Error('Grilling: plate contents were not saved');
 return out;
}
const plateFaults=new Set();
function plateFaultKey(block){return posKey(PLATE_PREFIX,block)+'_transaction_fault'}
function assertPlateAvailable(block){
 const receipt=world.getDynamicProperty(posKey(PLATE_PREFIX,block)+'_delivery');
 if(receipt&&JSON.parse(String(receipt)).phase!=='delivered')throw Error('Grilling: plate delivery requires recovery');
 const key=plateFaultKey(block);
 if(plateFaults.has(key)||world.getDynamicProperty(key)!==undefined)throw Error('Grilling: plate transaction quarantined');
}
function quarantinePlate(block,reason){
 const key=plateFaultKey(block);plateFaults.add(key);
 world.setDynamicProperty(key,String(reason));
 if(world.getDynamicProperty(key)!==String(reason))throw Error('Grilling: plate quarantine did not persist');
}
function readPlateBlock(block){
 assertPlateAvailable(block);
 return normalizePlateRows(decodePlateStorage(world.getDynamicProperty(posKey(PLATE_PREFIX,block))));
}
function blockPermutationStep(block,before,after){
 const dimension=block.dimension,location={...block.location};
 const target=()=>{const current=dimension.getBlock(location);if(!current)throw Error('Grilling: captured block unavailable');return current};
 const signature=p=>metadataSignature({id:p.type.id,states:p.getAllStates()});
 return verifiedPlateStep({read:()=>target().permutation,write:value=>target().setPermutation(value),before,after,signature});
}
function plateStorageStep(block,rows){
 assertPlateAvailable(block);
 const key=posKey(PLATE_PREFIX,block),before=world.getDynamicProperty(key);
 decodePlateStorage(before);decodePlateStorage(JSON.stringify(rows));
 const step=verifiedPlateStep({read:()=>world.getDynamicProperty(key),write:value=>world.setDynamicProperty(key,value),before,after:JSON.stringify(normalizePlateRows(rows))});
 const dimension=block.dimension,location={...block.location};let count;
 return {
  apply(){
   const current=dimension.getBlock(location);
   if(current?.typeId!==PLATE_BLOCK_ID)throw Error('Grilling: plate count target changed');
   const permutation=current.permutation;
   count=blockPermutationStep(current,permutation,permutation.withState('kaleidoscope_grilling:plate_count',rows.length));
   step.apply();count.apply();
  },
  rollback(){if(count)count.rollback();step.rollback()}
 };
}
function plateHandStep(captured,next){
 const signature=stack=>stack?metadataSignature({amount:stack.amount,...captureSkewerMetadata(stack)}):'';
 return verifiedPlateStep({read:captured.read,write:stack=>captured.write(stack?.clone()),before:captured.before,after:next,signature});
}
function plateTransaction(block,steps){
 const result=commitPlateSteps(steps,reason=>quarantinePlate(block,reason));
 if(!result.ok)console.warn('[Grilling plate transaction] '+result.error);
 if(result.ok)try{queueStationContentsVisual(block)}catch{}
 return result.ok;
}
function syncPlateCount(block,count){
 const expected=Math.max(0,Math.min(5,count|0));
 block.setPermutation(block.permutation.withState('kaleidoscope_grilling:plate_count',expected));
 if(block.permutation.getState('kaleidoscope_grilling:plate_count')!==expected)throw Error('Grilling: plate count rejected');
}
function writePlateBlock(block,rows){
 const clean=normalizePlateRows(rows),value=JSON.stringify(clean);world.setDynamicProperty(posKey(PLATE_PREFIX,block),value);
 if(world.getDynamicProperty(posKey(PLATE_PREFIX,block))!==value)throw Error('Grilling: plate block write rejected');syncPlateCount(block,clean.length);
}
function clearPlateBlock(block){world.setDynamicProperty(posKey(PLATE_PREFIX,block))}
function readBookRecord(book){
 try{
  const raw=getItemProperty(book,BOOK_RECORD_KEY);if(typeof raw!=='string')return null;
  const record=JSON.parse(raw);
  return record&&typeof record.resultId==='string'?record:null;
 }catch{return null}
}
function bookItem(record,recordedStack,template){
 let out;try{out=template?.typeId===BOOK_ID?cloneOne(template):new ItemStack(BOOK_ID,1)}catch{return undefined}
 const value=record?{...record,recordedStack:recordedStack??record.recordedStack??null}:null;
 let lore=[];try{lore=getItemRawLore(out).filter(x=>!(typeof x==='string'?x:x?.text??'').startsWith('§7Recipe:'))}catch{}
 lore.push(value?('§7Recipe: '+value.resultId.replace(/^.*:/,'')).slice(0,50):'§7Recipe: <empty>');
 setItemLore(out,lore);const serialized=value?JSON.stringify(value):undefined;setItemProperty(out,BOOK_RECORD_KEY,serialized);
 if(getItemProperty(out,BOOK_RECORD_KEY)!==serialized)throw Error('Grilling: recipe record was not saved');
 return out;
}
const recipeFaults=new Set();let recipePlacementSequence=0;
function recipeFaultKey(block){return posKey(RECIPE_PREFIX,block)+'_transaction_fault'}
function assertRecipeAvailable(block){
 const key=recipeFaultKey(block);
 if(recipeFaults.has(key)||world.getDynamicProperty(key)!==undefined)throw Error('Grilling: recipe transaction quarantined');
 if(world.getDynamicProperty(posKey(RECIPE_PREFIX,block)+'_delivery')!==undefined)throw Error('Grilling: recipe delivery requires recovery');
}
function quarantineRecipe(block,reason){
 const key=recipeFaultKey(block);recipeFaults.add(key);world.setDynamicProperty(key,String(reason));
 if(world.getDynamicProperty(key)!==String(reason))throw Error('Grilling: recipe quarantine did not persist');
}
function recipeTransaction(block,steps){
 const result=commitPlateSteps(steps,reason=>quarantineRecipe(block,reason));
 if(!result.ok)console.warn('[Grilling recipe transaction] '+result.error);
 if(result.ok)try{queueStationContentsVisual(block)}catch{}
 return result.ok;
}
function readRecipeBlock(block){
 assertRecipeAvailable(block);
 const raw=world.getDynamicProperty(posKey(RECIPE_PREFIX,block));if(raw===undefined)return null;
 if(typeof raw!=='string')throw Error('Grilling: unreadable recipe storage');
 const row=JSON.parse(raw);
 if(!row||row.id!==BOOK_ID||(row.native&&(row.native.version!==1||row.native.id!==BOOK_ID)))throw Error('Grilling: invalid recipe storage');
 return row;
}
function recipePropertyStep(key,before,after){
 return verifiedPlateStep({read:()=>world.getDynamicProperty(key),write:value=>world.setDynamicProperty(key,value),before,after});
}
function recipeActionSnapshot(block){
 return {dimension:block.dimension,location:{...block.location},states:metadataSignature(block.permutation.getAllStates()),saved:world.getDynamicProperty(posKey(RECIPE_PREFIX,block))};
}
function sameRecipeForAction(row){
 const block=row.dimension.getBlock(row.location);
 return block?.typeId===RECIPE_BLOCK_ID&&metadataSignature(block.permutation.getAllStates())===row.states&&world.getDynamicProperty(posKey(RECIPE_PREFIX,block))===row.saved?block:undefined;
}
function recipeRemovalStep(block){
 return blockPermutationStep(block,block.permutation,BlockPermutation.resolve('minecraft:air'));
}
function recipeInventoryDelivery(player,book){
 const container=mainContainer(player);if(!container)return undefined;
 // Recipe books stack to one. Plan a single empty slot, with native readback,
 // rather than retrying addItem after an exception that may follow its write.
 for(let slot=0;slot<Math.min(36,container.size);slot++)if(!container.getItem(slot))return plateHandStep({before:undefined,read:()=>container.getItem(slot),write:stack=>container.setItem(slot,stack)},book);
 return undefined;
}
function settleRecipeBlock(block,{player,pickup=false}={}){
 if(!block||block.typeId!==RECIPE_BLOCK_ID)return false;
 const row=readRecipeBlock(block),book=restoreStack(row),snapshot=recipeActionSnapshot(block),dimension=block.dimension;
 if(row&&(!book||!readBookRecord(book)))throw Error('Grilling: recorded recipe cannot be restored');
 const drop=book&&(pickup||!creative(player))?book:undefined;
 const key=posKey(RECIPE_PREFIX,block),receiptKey=key+'_delivery',beforeReceipt=world.getDynamicProperty(receiptKey);
 const receipt={v:1,phase:'prepared',dimension:dimension.id,location:snapshot.location,states:snapshot.states,saved:snapshot.saved};
 const prepared=JSON.stringify(receipt),credited=JSON.stringify({...receipt,phase:'credited'});
 let escrow,spawnAttempted=false;
 const inventory=drop&&pickup?recipeInventoryDelivery(player,drop):undefined;
 const signature=stack=>stack?metadataSignature({amount:stack.amount,...captureSkewerMetadata(stack)}):'';
 const delivery=inventory??{
  apply(){
   if(!drop)return;
   try{
    spawnAttempted=true;
    escrow=dimension.spawnItem(drop,{x:block.x+.5,y:block.y+.5,z:block.z+.5});
    if(escrow?.isValid!==true||signature(escrow.getComponent('minecraft:item')?.itemStack)!==signature(drop))throw Error('Grilling: recipe drop readback differs');
   }catch(error){if(!escrow)quarantineRecipe(block,'recipe drop spawn outcome unknown; saved book retained');throw error}
  },
  rollback(){
   if(!spawnAttempted)return;
   if(!escrow)throw Error('Grilling: recipe spawn result unavailable');
   if(escrow.isValid===false)return;
   if(escrow.isValid!==true||signature(escrow.getComponent('minecraft:item')?.itemStack)!==signature(drop))throw Error('Grilling: recipe drop ownership unconfirmed');
   try{escrow.remove()}catch(error){if(escrow.isValid!==false)throw error}
   if(escrow.isValid!==false)throw Error('Grilling: recipe drop cleanup unconfirmed');
  }
 };
 return recipeTransaction(block,[recipePropertyStep(receiptKey,beforeReceipt,prepared),delivery,
  recipePropertyStep(receiptKey,prepared,credited),recipePropertyStep(key,snapshot.saved,undefined),recipeRemovalStep(block),recipePropertyStep(receiptKey,credited,undefined)]);
}
// A verified credit may survive a restart before source cleanup. Finish only
// cleanup; this path never issues an item. A prepared/unknown credit cannot be
// replayed safely, so retain its source snapshot for explicit recovery.
function recoverRecipeDelivery(block){
 if(!block)return false;
 const key=posKey(RECIPE_PREFIX,block),receiptKey=key+'_delivery',raw=world.getDynamicProperty(receiptKey);if(raw===undefined)return false;
 if(recipeFaults.has(recipeFaultKey(block))||world.getDynamicProperty(recipeFaultKey(block))!==undefined)return false;
 const receipt=JSON.parse(String(raw));
 if(receipt?.v!==1||receipt.phase!=='credited'||receipt.dimension!==block.dimension.id||metadataSignature(receipt.location)!==metadataSignature(block.location))return false;
 const saved=world.getDynamicProperty(key);
 if((saved!==undefined&&saved!==receipt.saved)||(block.typeId===RECIPE_BLOCK_ID&&metadataSignature(block.permutation.getAllStates())!==receipt.states)){
  quarantineRecipe(block,'credited recipe cleanup target changed; no second delivery');return false;
 }
 return recipeTransaction(block,[recipePropertyStep(key,saved,undefined),...(block.typeId===RECIPE_BLOCK_ID?[recipeRemovalStep(block)]:[]),recipePropertyStep(receiptKey,raw,undefined)]);
}
function recoverRecordedRecipeDeliveries(){
 for(const key of world.getDynamicPropertyIds())if(key.startsWith(RECIPE_PREFIX)&&key.endsWith('_delivery'))try{
  const receipt=JSON.parse(String(world.getDynamicProperty(key)));
  if(receipt?.phase!=='credited'||typeof receipt.dimension!=='string'||!['x','y','z'].every(axis=>Number.isSafeInteger(receipt.location?.[axis])))continue;
  const block=world.getDimension(receipt.dimension).getBlock(receipt.location);
  if(block&&posKey(RECIPE_PREFIX,block)+'_delivery'===key)recoverRecipeDelivery(block);
 }catch(error){console.warn('[Grilling recipe delivery recovery] retained '+error)}
}
function faceName(face){return String(face??'').toLowerCase()}
function faceOffset(face){
 switch(faceName(face)){case'north':return{x:0,y:0,z:-1};case'south':return{x:0,y:0,z:1};case'west':return{x:-1,y:0,z:0};case'east':return{x:1,y:0,z:0};case'up':return{x:0,y:1,z:0};case'down':return{x:0,y:-1,z:0};default:return null}
}
function blockAtOffset(block,off){return off?block.dimension.getBlock({x:block.x+off.x,y:block.y+off.y,z:block.z+off.z}):undefined}
function isAirReplaceable(block){return !!block&&['minecraft:air','minecraft:short_grass','minecraft:tall_grass','minecraft:snow_layer'].includes(block.typeId)}
function setFacing(block,face){
 const f=faceName(face);if(!['north','south','west','east'].includes(f))return;
 try{block.setPermutation(block.permutation.withState('minecraft:cardinal_direction',f))}catch{}
}
function placePlateOn(support,face,player,source,hand='main'){
 if(faceName(face)!=='up'||!player.isSneaking)return false;
 if(support.typeId===COOKERY_TABLE&&!grillingConfig().interceptCookeryTableWhenPlacingPlate)return false;
 if(support.typeId!==COOKERY_TABLE&&hasFullCubeCollision(support)!==true)return false;
 const target=blockAtOffset(support,{x:0,y:1,z:0});if(!isAirReplaceable(target))return false;
 let rows=[];
 if(source?.typeId===PLATE_ID)rows=plateRowsFromItem(source);
 else if(isSkewer(source))rows=[stackRow(source)];
 else return false;
 if(!rows.length)return false;
 if(!plateItem(rows))throw Error('Grilling: plate contents cannot be packed');
 assertPlateAvailable(target);
 if(world.getDynamicProperty(posKey(PLATE_PREFIX,target))!==undefined)throw Error('Grilling: orphaned plate contents require recovery');
 const captured=captureWritableHand(player,hand),before=target.permutation,facing=plateFacingFromYaw(player.getRotation().y);
 if(interactionStackSignature(captured.before)!==interactionStackSignature(source))return false;
 const next=captured.before?.clone();if(!next)return false;
 const remainder=next.amount===1?undefined:next;if(remainder)remainder.amount--;
 const place=blockPermutationStep(target,before,BlockPermutation.resolve(PLATE_BLOCK_ID,{'minecraft:cardinal_direction':facing}));
 if(!plateTransaction(target,[place,plateStorageStep(target,rows),...(creative(player)?[]:[plateHandStep(captured,remainder)])]))return false;
 try{target.dimension.playSound('dig.wood',target.location,{volume:.8,pitch:1})}catch{}
 return true;
}
function handlePlateBlock(block,player,hand='main'){
 if(!block||block.typeId!==PLATE_BLOCK_ID)return;
 const held=heldByHand(player,hand),rows=readPlateBlock(block);
 if(held&&isSkewer(held)){
  if(player.isSneaking&&hand==='off')return;
  const added=plateAdd(rows,stackRow(held));if(!added.ok){message(player,'§e烤串盤已滿 5/5');return}
  if(!plateItem(added.rows))throw Error('Grilling: plate could not be reconstructed'); // Preflight item storage limits before taking any skewer.
  const captured=captureWritableHand(player,hand),next=captured.before?.clone();if(!next)return;
  const remainder=next.amount===1?undefined:next;if(remainder)remainder.amount--;
  if(!plateTransaction(block,[plateStorageStep(block,added.rows),...(creative(player)?[]:[plateHandStep(captured,remainder)])]))return;
  try{block.dimension.playSound('block.itemframe.add_item',block.location,{volume:.8,pitch:1})}catch{};return;
 }
 if(held)return;
 const removed=plateRemoveLast(rows);if(!removed.ok)return;
 const stack=restoreStack(removed.removed);if(!stack)return;
 const captured=captureWritableHand(player,hand);if(captured.before)return;
 if(!plateTransaction(block,[plateStorageStep(block,removed.rows),plateHandStep(captured,stack)]))return;
 try{block.dimension.playSound('block.itemframe.remove_item',block.location,{volume:.8,pitch:1})}catch{}
}
function breakPlate(block,player){
 if(!block||block.typeId!==PLATE_BLOCK_ID)return false;
 const rows=readPlateBlock(block),loc={x:block.x+.5,y:block.y+.35,z:block.z+.5},dim=block.dimension,before=block.permutation;
 const drop=!creative(player)&&rows.length?plateItem(rows):undefined;
 if(!creative(player)&&rows.length&&!drop)throw Error('Grilling: plate drop could not be packed');
 const receiptKey=posKey(PLATE_PREFIX,block)+'_delivery',receiptBefore=world.getDynamicProperty(receiptKey),receipt={phase:'prepared',saved:world.getDynamicProperty(posKey(PLATE_PREFIX,block)),drop:!!drop};
 const journal=verifiedPlateStep({read:()=>world.getDynamicProperty(receiptKey),write:v=>world.setDynamicProperty(receiptKey,v),before:receiptBefore,after:JSON.stringify(receipt)});
 const signature=s=>s?metadataSignature({amount:s.amount,...captureSkewerMetadata(s)}):'';
 let escrow,spawnAttempted=false;
 const delivery={
  apply(){
   if(!drop)return;
   try{
    spawnAttempted=true;
    escrow=dim.spawnItem(drop,loc);
    if(escrow?.isValid!==true||signature(escrow.getComponent('minecraft:item')?.itemStack)!==signature(drop))throw Error('Grilling: plate drop readback differs');
   }catch(error){
    // A spawn call can fail after creating an inaccessible item. Never retry
    // automatically when no returned entity exists to confirm its removal.
    if(!escrow)quarantinePlate(block,'plate drop spawn outcome unknown');
    throw error;
   }
  },
  rollback(){
   if(!spawnAttempted)return;
   if(!escrow)throw Error('Grilling: plate drop spawn outcome unknown');
   if(escrow.isValid===false)return;
   if(escrow.isValid!==true||signature(escrow.getComponent('minecraft:item')?.itemStack)!==signature(drop))throw Error('Grilling: plate drop ownership unconfirmed');
   try{escrow.remove()}catch(error){if(escrow.isValid!==false)throw error}
   if(escrow.isValid!==false)throw Error('Grilling: plate drop cleanup unconfirmed');
  }
 };
 const key=posKey(PLATE_PREFIX,block),raw=world.getDynamicProperty(key);
 const clear=verifiedPlateStep({read:()=>world.getDynamicProperty(key),write:value=>world.setDynamicProperty(key,value),before:raw,after:undefined});
 const remove=blockPermutationStep(block,before,BlockPermutation.resolve('minecraft:air'));
 const commitReceipt=verifiedPlateStep({read:()=>world.getDynamicProperty(receiptKey),write:value=>world.setDynamicProperty(receiptKey,value),before:JSON.stringify(receipt),after:JSON.stringify({...receipt,phase:'delivered'})});
 return plateTransaction(block,[journal,delivery,clear,remove,commitReceipt]);
}
function recordBookFromSkewer(player,book,skewer,hand='main'){
 const custom=skewerIngredientIds(skewer),record=makeBookRecord(skewer.typeId,custom);
 if(!record){message(player,'§c這根串不能記錄成配方');return false}
 const out=bookItem(record,stackRow(skewer),book);if(!out)return false;
 const captured=captureWritableHand(player,hand);
 if(nativeItemSignature(captured.before)!==nativeItemSignature(book))return false;
 const result=commitPlayerItemTransaction(world,player,[plateHandStep(captured,out)],{tick:system.currentTick,label:'record recipe'});
 if(!result.ok){console.warn('[Grilling record recipe] '+result.error+'; rollback errors='+result.rollbackErrors);return false}
 return true;
}
function isRecipeStick(stack){
 if(stack?.typeId==='minecraft:stick')return true;
 if(stack?.typeId!==UNFINISHED_ID)return false;
 const raw=getItemProperty(stack,SKEWER_INGREDIENTS_KEY);
 return raw===undefined||(typeof raw==='string'&&raw.trim()==='[]');
}
function recipeCraftSteps(player,container,before,planned,captured,stickHand,output){
 const consumed=before.map(s=>s?.clone()),inputSlots=new Set();
 const free=creative(player);
 if(!free){
  for(const row of planned){
   const stack=consumed[row.slot];
   if(!stack||!Number.isInteger(row.count)||row.count<1||stack.amount<row.count)throw Error('Recipe inputs changed');
   if(stack.amount===row.count)consumed[row.slot]=undefined;else stack.amount-=row.count;
   inputSlots.add(row.slot);
  }
  if(stickHand==='main'){
   const slot=player.selectedSlotIndex,stack=consumed[slot];
   if(nativeItemSignature(before[slot])!==nativeItemSignature(captured.before)||!isRecipeStick(stack)||stack.amount<1)throw Error('Recipe stick changed');
   if(stack.amount===1)consumed[slot]=undefined;else stack.amount--;
   inputSlots.add(slot);
  }
 }
 const delivery=planOwnedInventoryDelivery(container,[output],{startingItems:consumed,dimension:player.dimension,location:player.location});
 const steps=[...inputSlots].map(slot=>ownedItemStep({read:()=>container.getItem(slot),write:stack=>container.setItem(slot,stack),before:before[slot],after:consumed[slot],canRestore:delivery.canRestoreInputs}));
 if(!free&&stickHand==='off'){
  const after=captured.before.amount===1?undefined:captured.before.clone();if(after)after.amount--;
  steps.push(ownedItemStep({read:()=>captured.read(),write:stack=>captured.write(stack),before:captured.before,after,canRestore:delivery.canRestoreInputs}));
 }
 return [...steps,...delivery.steps];
}
function craftFromBook(player,book,stickHand='off'){
 const record=readBookRecord(book);if(!record){message(player,'§7這本烤串食譜尚未記錄配方');return false}
 const stick=heldByHand(player,stickHand);if(!isRecipeStick(stick)){message(player,'§e需要木棍或空的未完成烤串');return false}
 const slots=bookIngredientSlots(record);if(!slots)return false;
 const c=mainContainer(player);if(!c)return false;
 const captured=captureWritableHand(player,stickHand);
 if(!isRecipeStick(captured.before)||nativeItemSignature(captured.before)!==nativeItemSignature(stick))return false;
 const before=Array.from({length:c.size},(_,i)=>c.getItem(i)?.clone());
 const inventory=before.map(s=>s?{id:s.typeId,count:s.amount,tags:s.getTags?.()??[]}:null);
 const planned=planInventoryConsumption(inventory,slots,[player.selectedSlotIndex]);
 if(!planned.ok){const labels=[];for(const id of planned.missing??[]){if(labels.length)labels.push({text:'/'});labels.push(id.startsWith('#')?{text:id}:{translate:itemTranslationKey(id)})}javaInteractionFeedback(player,'skewer_book_missing',[{rawtext:labels},1]);return false}
 // Java intentionally copies the recorded secret recipe, not newly consumed metadata.
 let output;
 if(record.resultId===SECRET_ID&&record.recordedStack){
  output=restoreStack(record.recordedStack);
  if(output){
   const lore=withoutAutomaticCreatorLore(output);
   setItemProperty(output,SECRET_COOKED_KEY,false);
   setItemProperty(output,SECRET_CREATOR_KEY,JSON.stringify({name:player.name,id:player.id}));
   setItemLore(output,[...lore,creatorLore(player.name)]);
  }
 }else if(record.resultId!==SECRET_ID)output=new ItemStack(record.resultId,1);
 if(!output)return false;
 const result=commitPlayerItemTransaction(world,player,recipeCraftSteps(player,c,before,planned.plan,captured,stickHand,output),{tick:system.currentTick,label:'recipe'});
 if(!result.ok){console.warn('[Grilling recipe] '+result.error+'; rollback errors='+result.rollbackErrors);interactionFailure(player,result.rollbackErrors?'§c製作交易需要恢復；已保留未確認的扣料，避免重複出料':'§c製作未完成，材料已回復');return false}
 useSound(player,'action_success',.7,1);return true;
}
function handleBookAir(player,item){
 const main=heldMain(player),off=heldOff(player),hand=main?.typeId===BOOK_ID?'main':off?.typeId===BOOK_ID?'off':null;if(!hand)return;
 const book=hand==='main'?main:off,record=readBookRecord(book);
 if(record&&isRecipeStick(heldOff(player))&&hand==='main'){craftFromBook(player,book);return}
 if(!record&&hand==='main'&&isRecordableStack(off)){recordBookFromSkewer(player,book,off,'main');return}
 message(player,record?'§7副手放空的未完成烤串即可按使用鍵自動取料製作':'§7副手放一根完整生串，再按使用鍵記錄配方');
}
function convertCookeryRecipe(player){
 const main=heldMain(player),off=heldOff(player);if(!main||!COOKERY_RECIPE_ITEMS.has(main.typeId)||!isRecordableStack(off))return false;
 const custom=skewerIngredientIds(off),record=makeBookRecord(off.typeId,custom);if(!record)return false;
 const out=bookItem(record,stackRow(off)),container=mainContainer(player);if(!out||!container)return false;
 const slot=player.selectedSlotIndex,captured=captureWritableHand(player,'main');
 if(nativeItemSignature(captured.before)!==nativeItemSignature(main))return false;
 const before=Array.from({length:container.size},(_,i)=>container.getItem(i)?.clone());
 if(nativeItemSignature(before[slot])!==nativeItemSignature(captured.before))return false;
 const consumed=before.map(s=>s?.clone()),free=creative(player);
 if(!free){if(consumed[slot].amount===1)consumed[slot]=undefined;else consumed[slot].amount--}
 const delivery=planOwnedInventoryDelivery(container,[out],{startingItems:consumed,dimension:player.dimension,location:player.location});
 const debit=ownedItemStep({read:captured.read,write:captured.write,before:captured.before,after:consumed[slot],canRestore:delivery.canRestoreInputs});
 const result=commitPlayerItemTransaction(world,player,[...(free?[]:[debit]),...delivery.steps],{tick:system.currentTick,label:'convert recipe'});
 if(!result.ok)console.warn('[Grilling convert recipe] '+result.error+'; rollback errors='+result.rollbackErrors);
 return result.ok;
}
function placeRecipeBlock(support,face,player,book,hand='main'){
 const f=faceName(face);if(!['north','south','west','east'].includes(f))return false;
 const record=readBookRecord(book);if(!record){message(player,'§c空白烤串食譜不能貼牆');return true}
 if(hasSturdySide(support,f)!==true)return false;
 const target=blockAtOffset(support,faceOffset(face));if(!isAirReplaceable(target))return false;
 assertRecipeAvailable(target);const key=posKey(RECIPE_PREFIX,target);
 if(world.getDynamicProperty(key)!==undefined)throw Error('Grilling: orphaned recipe contents require recovery');
 const captured=captureWritableHand(player,hand);if(interactionStackSignature(captured.before)!==interactionStackSignature(book))return false;
 const next=captured.before?.clone();if(!next)return false;
 const remainder=next.amount===1?undefined:next;if(remainder)remainder.amount--;
 const before=target.permutation,saved=JSON.stringify({...stackRow(book),placementId:system.currentTick+':'+(++recipePlacementSequence)});
 // Restore the snapshot before touching the hand, including native metadata.
 if(!readBookRecord(restoreStack(JSON.parse(saved))))throw Error('Grilling: recipe placement cannot be restored');
 const place=blockPermutationStep(target,before,BlockPermutation.resolve(RECIPE_BLOCK_ID,{'minecraft:cardinal_direction':f}));
 if(!recipeTransaction(target,[place,recipePropertyStep(key,undefined,saved),...(creative(player)?[]:[plateHandStep(captured,remainder)])]))return false;
 try{target.dimension.playSound('block.itemframe.place',target.location,{volume:.8,pitch:1})}catch{}return true;
}
function handleRecipeBlock(block,player,hand='main'){
 if(!block||block.typeId!==RECIPE_BLOCK_ID)return;
 const row=readRecipeBlock(block),book=restoreStack(row),held=heldByHand(player,hand);
 if(isRecipeStick(held)&&book){craftFromBook(player,book,hand);return}
 if(held)return;
 if(!settleRecipeBlock(block,{player,pickup:true}))return;
 try{block.dimension.playSound('block.itemframe.remove_item',block.location,{volume:.8,pitch:1})}catch{}
}
function breakRecipe(block,player){
 return settleRecipeBlock(block,{player});
}

world.beforeEvents.itemUse.subscribe(e=>{
 try{
  if(e.cancel)return;const id=e.itemStack?.typeId,p=e.source;
  if(skewerUseTargetsPlate(p,e.itemStack)){e.cancel=true;return}
  if(id===PLATE_ID&&plateRowsFromItem(e.itemStack).length===0){e.cancel=true;message(p,'§7空烤串盤不能食用');return}
  const intent=captureInteractionIntent(p,e.itemStack);if(intent.hand!=='main')return;
  if(COOKERY_RECIPE_ITEMS.has(id)&&isRecordableStack(heldOff(p))){
   e.cancel=true;const offSignature=interactionStackSignature(heldOff(p));
   system.run(()=>{if(!interactionIntentStillCurrent(p,intent)||interactionStackSignature(heldOff(p))!==offSignature){message(p,'§7操作已取消：食譜或副手烤串已變更');return}convertCookeryRecipe(p)});return;
  }
  if(id!==BOOK_ID)return;e.cancel=true;const offSignature=interactionStackSignature(heldOff(p));
  system.run(()=>{if(!interactionIntentStillCurrent(p,intent)||interactionStackSignature(heldOff(p))!==offSignature){message(p,'§7操作已取消：食譜書或副手材料已變更');return}handleBookAir(p)});
 }catch{}
});

onBlockInteraction('a25_plate_recipe_runtime',e=>{
 try{
  const block=e.block,p=e.player,intent=captureInteractionIntent(p,e.itemStack),hand=intent.hand,item=heldByHand(p,hand),first=isInitialBlockPress(e.isFirstEvent);
  const defer=fn=>system.run(()=>{if(!interactionIntentStillCurrent(p,intent)){message(p,'§7操作已取消：互動後手持物品已改變');return}fn()});
  if(block.typeId===PLATE_BLOCK_ID){
   if(item&&isSkewer(item)&&p.isSneaking&&hand==='off')return;
   if(!item&&readPlateBlock(block).length===0)return;
   e.cancel=true;if(!first)return;const loc={...block.location},dim=block.dimension;defer(()=>handlePlateBlock(dim.getBlock(loc),p,hand));return;
  }
  if(block.typeId===RECIPE_BLOCK_ID){
   if(item&&!isRecipeStick(item))return;
   e.cancel=true;if(!first)return;const snapshot=recipeActionSnapshot(block);defer(()=>handleRecipeBlock(sameRecipeForAction(snapshot),p,hand));return;
  }
  if(p.isSneaking&&hand==='main'&&item&&COOKERY_RECIPE_ITEMS.has(item.typeId)&&isRecordableStack(heldOff(p))){
   e.cancel=true;if(!first)return;defer(()=>convertCookeryRecipe(p));return;
  }
  if(p.isSneaking&&item&&(item.typeId===PLATE_ID||isSkewer(item))&&faceName(e.blockFace)==='up'){
   if(isSkewer(item)&&hand!=='main')return;
   if(block.typeId===COOKERY_TABLE&&!grillingConfig().interceptCookeryTableWhenPlacingPlate)return;
   const loc={...block.location},dim=block.dimension,face=e.blockFace;e.cancel=true;if(!first)return;defer(()=>placePlateOn(dim.getBlock(loc),face,p,heldByHand(p,hand),hand));return;
  }
  if(item?.typeId===BOOK_ID&&['north','south','west','east'].includes(faceName(e.blockFace))){
   const loc={...block.location},dim=block.dimension,face=e.blockFace;e.cancel=true;if(!first)return;defer(()=>placeRecipeBlock(dim.getBlock(loc),face,p,heldByHand(p,hand),hand));return;
  }
 }catch{}
},{"priority":10});

world.beforeEvents.playerBreakBlock.subscribe(e=>{
 try{
  if(e.cancel)return;
  if(e.block.typeId===PLATE_BLOCK_ID){e.cancel=true;const p=e.player,loc={...e.block.location},dim=e.block.dimension;system.run(()=>breakPlate(dim.getBlock(loc),p));return}
  if(e.block.typeId===RECIPE_BLOCK_ID){e.cancel=true;const p=e.player,snapshot=recipeActionSnapshot(e.block);system.run(()=>{try{breakRecipe(sameRecipeForAction(snapshot),p)}catch(error){console.warn('[Grilling recipe break] retained '+error)}});return}
 }catch{}
});
world.beforeEvents.explosion.subscribe(e=>{
 try{if(e.cancel!==false)return}catch{return}
 const keep=[],plates=[],recipes=[];let protectedTarget=false;
 for(const block of e.getImpactedBlocks()){
  if(block.typeId===PLATE_BLOCK_ID){protectedTarget=true;plates.push({dimension:block.dimension,location:{...block.location}})}
  else if(block.typeId===RECIPE_BLOCK_ID){protectedTarget=true;try{recipes.push(recipeActionSnapshot(block))}catch(error){console.warn('[Grilling recipe explosion capture] retained '+error)}}
  else keep.push(block);
 }
 if(!protectedTarget)return;
 e.setImpactedBlocks(keep);if(!plates.length&&!recipes.length)return;
 system.run(()=>{
  // Another before-event subscriber may cancel after this one. Do not settle a
  // cancelled or unreadable event; no storage/drop mutation has happened yet.
  try{if(e.cancel!==false)return}catch(error){console.warn('[Grilling plate explosion status] '+error);return}
  for(const row of plates)try{breakPlate(row.dimension.getBlock(row.location))}catch(error){console.warn('[Grilling plate explosion recovery] '+error)}
  for(const row of recipes)try{breakRecipe(sameRecipeForAction(row))}catch(error){console.warn('[Grilling recipe explosion recovery] retained '+error)}
 });
});
function recipeSupport(block){
 try{
  const f=String(block.permutation.getState('minecraft:cardinal_direction')??'').toLowerCase(),op={north:{x:0,y:0,z:1},south:{x:0,y:0,z:-1},west:{x:1,y:0,z:0},east:{x:-1,y:0,z:0}}[f];
  return op?blockAtOffset(block,op):undefined;
 }catch{return undefined}
}
function detachUnsupportedRecipe(block){
 if(!block||block.typeId!==RECIPE_BLOCK_ID)return;
 recoverRecipeDelivery(block);if(block.typeId!==RECIPE_BLOCK_ID)return;
 if(recipeFaults.has(recipeFaultKey(block))||world.getDynamicProperty(recipeFaultKey(block))!==undefined||world.getDynamicProperty(posKey(RECIPE_PREFIX,block)+'_delivery')!==undefined)return;
 const support=recipeSupport(block),facing=block.permutation.getState('minecraft:cardinal_direction');
 // An unloaded/unreadable support is not evidence of removal. Native block
 // ticks resume when the chunk loads, including non-player neighbor changes.
 if(!support||hasSturdySide(support,facing)!==false)return;
 settleRecipeBlock(block);
}
function detachRecipeNeighbors(dimension,location){
 for(const off of [{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1}]){
  const block=dimension.getBlock({x:location.x+off.x,y:location.y,z:location.z+off.z});
  if(block?.typeId===RECIPE_BLOCK_ID)detachUnsupportedRecipe(block);
 }
}
world.afterEvents.playerBreakBlock.subscribe(e=>{
 try{
  const dim=e.block.dimension,loc={...e.block.location};system.run(()=>{
   const above=dim.getBlock({x:loc.x,y:loc.y+1,z:loc.z});if(above?.typeId===PLATE_BLOCK_ID&&!hasSolidTop(dim.getBlock(loc)))breakPlate(above);
   detachRecipeNeighbors(dim,loc);
  });
 }catch{}
});

// Prepared or unknown crash outcomes require review; replay never grants a new plate.
export function a25RetryPlateDelivery(){return false;}
world.afterEvents.blockExplode.subscribe(e=>{const d=e.dimension??e.block.dimension,at={...e.block.location};system.run(()=>{try{const b=d.getBlock({x:at.x,y:at.y+1,z:at.z});if(b?.typeId===PLATE_BLOCK_ID&&!hasSolidTop(d.getBlock(at)))breakPlate(b);detachRecipeNeighbors(d,at);}catch(error){console.warn('[Grilling container support] retained '+error)}});});
system.beforeEvents.startup.subscribe(({blockComponentRegistry})=>{
 blockComponentRegistry.registerCustomComponent('kaleidoscope_grilling:recipe_support',{onTick(e){try{detachUnsupportedRecipe(e.block)}catch(error){console.warn('[Grilling recipe support] retained '+error)}}});
});
// The block tick handles loaded recipes. This sparse receipt scan also finishes
// a credited cleanup whose source block had already become air before restart.
every('a25_plate_recipe_runtime:1',recoverRecordedRecipeDeliveries,200);

export function a25ReadPlateBlock(block){return readPlateBlock(block)}
export function a25ReadRecipeDisplayStack(block){
 const row=readRecipeBlock(block),book=restoreStack(row);if(!book)return undefined;
 const record=readBookRecord(book);if(!record)return undefined;
 // Match Java readRecipeStack: the recorded native stack precedes the ID
 // fallback. In particular, retain the secret ingredients/variants/cooked cache.
 if(record.recordedStack)return restoreStack(record.recordedStack);
 return record.resultId?new ItemStack(record.resultId,1):undefined;
}
export function a25ReadRecipeBlockSnapshot(block){
 const row=readRecipeBlock(block),book=restoreStack(row);if(!book)return null;
 const record=readBookRecord(book);if(!record||typeof record.resultId!=='string'||!record.resultId)return null;
 const slots=bookIngredientSlots(record);
 return {resultId:record.resultId,ingredientSlots:Array.isArray(slots)?slots.map(slot=>[...slot]):[]};
}
export function a25PlateRows(stack){return plateRowsFromItem(stack)}
export function a25PlateItem(rows,template){return plateItem(rows,template)}
export function a25RestoreStack(row){return restoreStack(row)}
export function a25StackRow(stack){return stackRow(stack)}
