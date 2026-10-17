// Runs only when copied into the reviewed Cookery host extension; not imported by Grilling.
import {world,system,ItemStack,GameMode,ItemTypes} from '@minecraft/server';
import {BOARD_API_VERSION,BOARD_CAPABILITIES,normalizeBoardV2Recipe,createBoardRegistry,executeBoardOperation,recoverBoardOperation} from './board_api_core.js';
export {BOARD_API_VERSION,BOARD_CAPABILITIES};
const registry=createBoardRegistry();
export function registerBoardV2Recipe(payload){
 const recipe=normalizeBoardV2Recipe(payload);if(!recipe)return {ok:false,reason:'schema'};
 const ids=[recipe.input,recipe.result,...(recipe.outputs??[]).map(x=>x.id),...recipe.bonusOutputs.map(x=>x.id)];
 try{if(ids.some(id=>!ItemTypes.get(id)))return {ok:false,reason:'item_unavailable'}}catch{return {ok:false,reason:'item_unavailable'}}
 const result=registry.register(payload);if(result.ok)console.log('[Cookery board API 0.1.0] registered '+recipe.id);return result;
}
export function getBoardV2Recipe(input,builtin){return registry.select(input,builtin)}
export function snapshotBoardIngredient(stack){
 const row={id:stack.typeId,count:1,name:stack.nameTag??'',rawLore:stack.getRawLore(),keepOnDeath:stack.keepOnDeath,lockMode:stack.lockMode,canDestroy:stack.getCanDestroy(),canPlaceOn:stack.getCanPlaceOn()};
 if(stack.maxAmount===1){row.props={};for(const key of stack.getDynamicPropertyIds())row.props[key]=stack.getDynamicProperty(key);}
 return row;
}
export function restoreBoardIngredient(row){
 const s=new ItemStack(row.id,row.count??1);
 if(row.rawLore){s.nameTag=row.name;s.setLore(row.rawLore);s.keepOnDeath=row.keepOnDeath;s.lockMode=row.lockMode;s.setCanDestroy(row.canDestroy);s.setCanPlaceOn(row.canPlaceOn);for(const [key,v] of Object.entries(row.props??{}))s.setDynamicProperty(key,v);}
 return s;
}
function stackKey(s){if(!s)return '';const row=snapshotBoardIngredient(s);row.count=s.amount;row.damage=s.getComponent('minecraft:durability')?.damage;return JSON.stringify(row)}
export function boardKnifeDamagePlan(stack,random=Math.random,free=false){
 if(free)return {mutate:false};const next=stack.clone(),d=next.getComponent('minecraft:durability');if(!d)throw Error('knife durability unavailable');
 const level=next.getComponent('minecraft:enchantable')?.getEnchantment('unbreaking')?.level??0;
 let chance;try{chance=d.getDamageChance(level)/100}catch{chance=1/(level+1)}
 if(random()>chance)return {mutate:false};
 if(d.damage>=d.maxDurability-1)return {mutate:true,broken:true,next:undefined};d.damage++;return {mutate:true,next};
}
export function boardReceiptKey(block){return 'kaleidoscope_cookery:board_v2_'+block.dimension.id.replace(/[^a-z0-9_]/g,'_')+'_'+block.x+'_'+block.y+'_'+block.z;}
export function createBoardHostIO(block,player,host){
 const key=boardReceiptKey(block),equipment=player?host.slot(player):undefined;
 const checked=(expected)=>{let error;try{host.save(block,expected)}catch(e){error=e}const raw=host.raw(block),actual=raw===undefined?{}:JSON.parse(raw);if(JSON.stringify(actual)!==JSON.stringify(expected))throw error??Error('board state write not acknowledged');};
 const receipt=()=>{const raw=world.getDynamicProperty(key);return raw===undefined?undefined:JSON.parse(String(raw));};
 const writeReceipt=r=>{const raw=JSON.stringify(r);world.setDynamicProperty(key,raw);if(world.getDynamicProperty(key)!==raw)throw Error('receipt write not acknowledged');};
 const spawn=s=>{const entity=block.dimension.spawnItem(s,{x:block.x+.5,y:block.y+.45,z:block.z+.5});const actual=entity?.getComponent('minecraft:item')?.itemStack;
  if(!entity||!actual||stackKey(actual)!==stackKey(s)){const error=Error('native drop readback failed');if(entity){error.receipt={undo(){entity.remove();if(entity.isValid)throw Error('drop still present')}};error.uncertain=false}throw error;}
  return {acknowledged:true,undo(){entity.remove();if(entity.isValid)throw Error('drop still present')}};
 };
 const io={creative:player?.getGameMode?.()===GameMode.Creative,sneaking:!!player?.isSneaking,
  readState:()=>host.load(block),writeState:checked,readReceipt:receipt,writeReceipt,
  readHeld:()=>equipment?.hasItem()?equipment.getItem():undefined,
  writeHeld:s=>{if(!equipment)throw Error('hand unavailable');let error;try{equipment.setItem(s)}catch(e){error=e}const actual=equipment.hasItem()?equipment.getItem():undefined;if(stackKey(actual)!==stackKey(s))throw error??Error('hand write not acknowledged')},
  newOperationId:()=>{const counterKey=key+'_sequence',n=Number(world.getDynamicProperty(counterKey)??0)+1;if(!Number.isSafeInteger(n))throw Error('operation sequence invalid');world.setDynamicProperty(counterKey,n);if(world.getDynamicProperty(counterKey)!==n)throw Error('operation sequence unavailable');return key+':'+n},snapshot:snapshotBoardIngredient,
  isKnife:host.isKnife,damagePlan:(s,r)=>boardKnifeDamagePlan(s,r,io.creative),
  deliver(row,refund){const s=restoreBoardIngredient(row);
   if(refund&&player){const c=player.getComponent('minecraft:inventory')?.container;if(!c)throw Error('refund inventory unavailable');for(let i=0;i<c.size;i++)if(!c.getItem(i)){const rollback={undo(){c.setItem(i,undefined);if(c.getItem(i))throw Error('refund rollback')}};try{c.setItem(i,s);if(stackKey(c.getItem(i))!==stackKey(s))throw Error('refund write not acknowledged')}catch(error){error.receipt=rollback;error.uncertain=false;throw error}return {acknowledged:true,...rollback}}}
   return spawn(s);
  },
  particles:()=>{if(player)host.particles(block,player)},sound:kind=>{if(player)host.sound(player,kind)},
  notice:(kind,cuts,max)=>{if(player)host.notice(player,{translate:'message.kg.board_'+kind,with:[String(cuts??0),String(max??4)]})},
  quarantine(state,reason){const op=state.boardV2;try{writeReceipt({version:BOARD_API_VERSION,operationId:op?.operationId??'unknown',phase:'quarantined',reason:String(reason).slice(0,256)})}catch{};try{const next=JSON.parse(JSON.stringify(state));if(next.boardV2)next.boardV2.phase='quarantined';checked(next)}catch{};console.warn('[Cookery board API] operation quarantined '+key)}
 };return io;
}
export function handleBoardV2(block,player,host){
 const held=host.held(player),recipe=getBoardV2Recipe(held?.typeId,host.builtin[held?.typeId]);
 return executeBoardOperation(createBoardHostIO(block,player,host),recipe);
}
export function recoverBoardV2(id,block,state,host){if(id!=='kaleidoscope_cookery:chopping_board'||!state?.boardV2)return false;return recoverBoardOperation(createBoardHostIO(block,undefined,host),state);}
