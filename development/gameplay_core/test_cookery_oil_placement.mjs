/** Actual patched author callback + owned oil module; API doubles, no game actors. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as oil from '../../projects/grilling/gameplay_core/behavior_pack/scripts/host_api/oil_api_core.js';

const fixture=process.env.COOKERY_OIL_PLACEMENT_FIXTURE;
assert(fixture,'COOKERY_OIL_PLACEMENT_FIXTURE must name the hash-verified Git-external actual host fixture');
const author=fs.readFileSync(path.join(fixture,'oilPot.js'),'utf8');
const registry=fs.readFileSync(path.join(fixture,'oilContainers.js'),'utf8');
const owned=fs.readFileSync(process.env.COOKERY_OIL_OWNER_SOURCE??new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/host_api/oil_api_host.js',import.meta.url),'utf8');
const strip=s=>s.replace(/^import\s[^;]+;\s*/gm,'').replace(/^export /gm,'');
class Item{
 constructor(typeId,amount=1){this.typeId=typeId;this.amount=amount;this.props={};this.lore=[];}
 clone(){return Object.assign(new Item(this.typeId,this.amount),structuredClone({...this}));}
 getDynamicProperty(k){return this.props[k];}getDynamicPropertyIds(){return Object.keys(this.props);}
 setDynamicProperty(k,v){if(v===undefined)delete this.props[k];else this.props[k]=v;}
 getRawLore(){return structuredClone(this.lore);}setLore(v){this.lore=structuredClone(v);}
}
function setup(item){
 const dp=new Map(),subscriptions=new Map(),queued=[],timeouts=[];
 const signal=k=>({subscribe(fn){const rows=subscriptions.get(k)??[];rows.push(fn);subscriptions.set(k,rows);}});
 const world={getDynamicProperty:k=>dp.get(k),setDynamicProperty(k,v){if(v===undefined)dp.delete(k);else dp.set(k,v);},getAllPlayers:()=>[],
  beforeEvents:{playerPlaceBlock:signal('before_place'),playerInteractWithBlock:signal('interact'),playerBreakBlock:signal('before_break'),explosion:signal('explosion')},
  afterEvents:Object.fromEntries(['playerSpawn','playerPlaceBlock','playerBreakBlock','blockExplode','itemStartUseOn'].map(k=>[k,signal(k)]))};
 const system={currentTick:100,run:fn=>queued.push(fn),runTimeout:fn=>timeouts.push(fn),sendScriptEvent(){},afterEvents:{scriptEventReceive:signal('script')}};
 const slot={hasItem:()=>!!item,getItem:()=>item?.clone(),setItem(value){item=value?.clone();}};
 const dimension={id:'minecraft:overworld',getBlock:()=>block};
 const permutation=value=>({getState:()=>value,withState:(_k,v)=>permutation(v),type:{id:oil.EMPTY_POT}});
 const block={typeId:oil.EMPTY_POT,dimension,x:3,y:65,z:4,location:{x:3,y:65,z:4},permutation:permutation(false),setPermutation(p){this.permutation=p;}};
 const player={id:'placement_owner',getComponent:()=>({getEquipmentSlot:()=>slot}),getGameMode:()=> 'Survival'};
 const imports={...oil,world,system,ItemStack:Item,EquipmentSlot:{Mainhand:'Mainhand',Offhand:'Offhand'},GameMode:{Creative:'Creative'},console};
 const ctx=vm.createContext({...imports});
 const exports=[...owned.matchAll(/^export function (\w+)/gm)].map(x=>x[1]);
 vm.runInContext(strip(owned)+'\nglobalThis.api={'+exports.join(',')+'};',ctx);
 const registryContext=vm.createContext({...imports});
 vm.runInContext(strip(registry)+'\nglobalThis.api={registerOilContainer,consumeRegisteredOilFromHeld,readRegisteredOilAmount};',registryContext);
 const host=vm.createContext({...imports,...ctx.api,...registryContext.api,playSoundAccessible(){}});
 vm.runInContext(strip(author)+'\nglobalThis.component=oilPotComponent;globalThis.consume=consumeOilFromHeldContainer;',host);
 return {api:ctx.api,registry:registryContext.api,consume:host.consume,block,player,system,dp,slot,component:host.component,
  place({capture=true}={}){
   const event={player,block,permutationToPlace:permutation(false)};
   if(capture)host.component.beforeOnPlayerPlace(event);
   else event.permutationToPlace=permutation(true);
   block.permutation=event.permutationToPlace;
   host.component.onPlace({block});
   for(const fn of subscriptions.get('playerPlaceBlock')??[])fn({player,block});
  },
  flush(){while(queued.length)queued.shift()();},timeouts,
  setFilled(){block.permutation=permutation(true);},
 };
}

test('actual filled placement initializes exact captured quantity before any legacy read',()=>{
 for(const [type,count,legacy] of [['',256,true],['',32,true],['canola',8,false],['premium_chili',64,false],['',0,false]]){
  const item=legacy?new Item(oil.FILLED_POT):oil.createPublicOilPot(Item,type,count);
  if(legacy&&count!==256)item.props.kc_oil_count=count;
  const f=setup(item);
  assert.doesNotThrow(()=>f.place(),type+':'+count);
  assert.equal(f.api.readSharedPlacedOil(f.block).count,count);
  assert.equal(f.api.readSharedPlacedOil(f.block).type,type);
  assert.equal(f.dp.get('kc_oilpot:minecraft:overworld:3,65,4'),count||undefined);
  const before=JSON.stringify([...f.dp]);f.flush();assert.equal(JSON.stringify([...f.dp]),before,'no deferred author overwrite');
 }
});

test('the actual author foreign-oil registry still handles its own debit and empty remainder',()=>{
 const item=new Item('external:oil_can');item.nameTag='kept metadata';
 const f=setup(item);
 assert.equal(f.registry.registerOilContainer({api:1,source:'external',container:{id:'external:oil_can',empty:'external:empty_can',oil:'external:oil',capacity:3,defaultAmount:3,amountProperty:'external:amount'}}).ok,true);
 for(const n of [2,1]){assert.equal(f.consume(f.player),true);assert.equal(f.registry.readRegisteredOilAmount(f.slot.getItem()),n);assert.equal(f.slot.getItem().nameTag,'kept metadata');}
 assert.equal(f.consume(f.player),true);assert.equal(f.slot.getItem().typeId,'external:empty_can');
});

test('an earlier capture timeout cannot discard a newer valid placement',()=>{
 const f=setup(oil.createPublicOilPot(Item,'canola',8));
 f.api.captureSharedOilPlacement({player:f.player,block:f.block});const oldExpiry=f.timeouts.at(-1);
 f.system.currentTick+=10;f.api.captureSharedOilPlacement({player:f.player,block:f.block});
 oldExpiry();f.setFilled();assert.equal(f.api.finalizeSharedOilPlacement({player:f.player,block:f.block}),true);
 assert.equal(f.api.readSharedPlacedOil(f.block).count,8);
});

test('actual callback cannot initialize an unknown legacy filled block without a captured item',()=>{
 const f=setup(new Item(oil.FILLED_POT));f.place({capture:false});
 assert.throws(()=>f.api.readSharedPlacedOil(f.block),/unknown legacy placed oil/);
 assert.equal(f.dp.size,0,'neither empty nor full is inferred');
});

test('captured placement is single-use, position-bound and expires without touching other blocks',()=>{
 for(const change of ['position','expired','clock_rewind','replayed']){
  const f=setup(oil.createPublicOilPot(Item,'secret_chili',16));
  f.api.captureSharedOilPlacement({player:f.player,block:f.block});f.setFilled();
  if(change==='position')f.block.x++;
  if(change==='expired')f.system.currentTick+=13;
  if(change==='clock_rewind')f.system.currentTick--;
  if(change==='replayed'){assert.equal(f.api.finalizeSharedOilPlacement({player:f.player,block:f.block}),true);f.dp.clear();}
  assert.equal(f.api.finalizeSharedOilPlacement({player:f.player,block:f.block}),false);
  assert.equal(f.dp.size,0,change);
  assert.throws(()=>f.api.readSharedPlacedOil(f.block),/unknown legacy placed oil/);
 }
});

test('an unresolved location receipt still blocks captured placement initialization',()=>{
 const f=setup(oil.createPublicOilPot(Item,'canola',8));
 f.api.captureSharedOilPlacement({player:f.player,block:f.block});f.setFilled();
 const k='senluo:oil_api_recovery:minecraft:overworld:3,65,4';f.dp.set(k,JSON.stringify({phase:'quarantined'}));
 assert.throws(()=>f.api.finalizeSharedOilPlacement({player:f.player,block:f.block}),/oil recovery unresolved/);
 assert.equal(f.dp.size,1);assert.equal(JSON.parse(f.dp.get(k)).phase,'quarantined');
});
