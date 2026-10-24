import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFixture} from './minecraft-fixture.mjs';
import {canonicalFoodId} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/eating_profile_ids.js';

// Java 1.1.1 NeoForge MultiBiteSkewerItem: AnimationProfile L36-41,
// visualBiteStage L98, use L127, release/settlement L250. This reads extracted
// DATA, never JavaScript source. No source slicing or replacement runtime.
export const java = JSON.parse(readFileSync(new URL('../../data/java/eating_profiles.json', import.meta.url))).loaders['neoforge-1.21.1'];
const N = 'kaleidoscope_grilling:';
export const beef = N + 'grilled_beef_skewer';
const code = {ONE:1,TWO:2,THREE:3,THREE_ALT:4,FOUR:5};
export const routes = Object.entries({...java.profile_by_item, [N+'secret_skewer']:{profile:'THREE_RANDOM'}}).flatMap(([base,row]) => {
  const profile = row.profile === 'THREE_RANDOM' ? 'THREE' : row.profile;
  return [
    {base,id:base,profile,duration:java.profiles[profile].duration_ticks,kind:'base'},
    ...(row.profile === 'THREE_RANDOM' ? [{base,id:base+'_java_three_alt',profile:'THREE_ALT',duration:90,kind:'ALT'}] : []),
    {base,id:base+'_native_plain',profile,duration:java.minimum_eat_ticks,kind:'plain'},
  ];
}).map(route=>{
  const path=new URL('../../projects/grilling/gameplay_core/behavior_pack/items/'+route.id.split(':')[1]+'.json',import.meta.url);
  const item=JSON.parse(readFileSync(path,'utf8'))['minecraft:item'];
  assert.equal(item.description.identifier,route.id);
  const nativeDuration=item.components['minecraft:use_modifiers'].use_duration*20;
  assert.equal(nativeDuration,route.duration,`${route.id} native duration versus pinned Java profile`);
  return {...route,duration:nativeDuration};
});

export async function createEatingLab({deferEntityProperties=false}={}) {
  const f = createFixture({currentTick:1000,deferEntityProperties});
  await f.load('main.js');
  const data = await f.load('itemData.js');
  const config = await f.load('server_config_runtime.js');
  const snapshot = await f.load('skewer_item_snapshot.js');
  const effects = await f.load('effect_state_runtime.js');
  const lab = {f,data,config,snapshot,effects,rows:[]};
  lab.ownedStack=stack=>stack?{...snapshot.captureSkewerMetadata(stack),id:canonicalFoodId(stack.typeId),amount:stack.amount}:null;
  lab.inventory=p=>({selectedSlot:p.selectedSlotIndex,main:lab.ownedStack(p.main),off:lab.ownedStack(p.off),
    slots:p.inventory.items().map((stack,slot)=>({slot,stack:lab.ownedStack(stack)}))});
  lab.actor = (route, hand='main', amount=2) => {
    config.setGrillingConfig('enableEatingAnimations',route.kind !== 'plain');
    config.setGrillingConfig('graphicalEatingHud',false);
    const stack=f.item(route.id,amount,{nameTag:'Timeline serving',lore:['foreign metadata']});
    data.setItemProperty(stack,'foreign:timeline','retained');
    if(route.base === N+'secret_skewer') data.setItemProperty(stack,N+'skewer_ingredients',JSON.stringify([
      {id:N+'raw_beef_skewer',nutrition:2,saturation:.3,edible:true,convertTo:''},
      {id:N+'raw_fish_skewer',nutrition:3,saturation:.225,edible:true,convertTo:''},
      {id:N+'raw_bun_slice_skewer',nutrition:2,saturation:.3,edible:true,convertTo:''},
    ]));
    const p=f.player({[hand]:stack});
    for(const [kind,value] of [['hunger',2],['saturation',0]]) p.components['minecraft:player.'+kind]={currentValue:value,effectiveMax:20,setCurrentValue(next){this.currentValue=next;}};
    const animations=[];
    // Only the external API is supplied; no animation is evaluated or rendered.
    p.playAnimation=(name,options)=>animations.push({tick:f.system.currentTick,name,options});
    const a={route,hand,p,stack:stack.clone(),start:f.system.currentTick,animations};
    a.event=(name,remaining)=>f.emit('world.afterEvents.'+name,{source:p,itemStack:a.stack.clone(),useDuration:remaining});
    a.begin=()=>{a.start=f.system.currentTick;a.stack=p[hand].clone();a.event('itemStartUse',route.duration);};
    a.sample=(phase,ownership=false)=>{
      const row={case:a.case??'normal',base:route.base,id:route.id,kind:route.kind,hand,tick:f.system.currentTick,elapsed:f.system.currentTick-a.start,phase,
        profile:p.getProperty(N+'eat_profile')??0,handCode:p.getProperty(N+'eat_hand')??0,projection:p.getProperty(N+'eat_projection')??false,
        clock:p.getProperty(N+'eat_elapsed_ticks')??0,nativeTicks:p.getProperty(N+'eat_native_ticks')??0,
        main:p.main?{id:p.main.typeId,amount:p.main.amount}:null,off:p.off?{id:p.off.typeId,amount:p.off.amount}:null,
        hunger:p.components['minecraft:player.hunger'].currentValue,saturation:p.components['minecraft:player.saturation'].currentValue,
        effects:f.effects.filter(e=>e.source===p).length,crumbs:f.particles.filter(e=>e.particle===N+'skewer_crumb').length,
        clips:animations.map(e=>e.name),...(ownership?{ownership:lab.inventory(p)}:{})};
      lab.rows.push(row);return row;
    };
    a.advance=(ticks,record=false)=>{for(let i=0;i<ticks;i++){f.tick();if(record)a.sample('tick');f.writes.length=0;}};
    // Explicit engine-input assumption. The fake boundary does not implement
    // native food debit/nutrition, use cancellation, packet order, or rendering.
    a.nativeDebit=()=>{const held=p[hand];if(held.amount>1){held.amount--;p[hand]=held;}else p[hand]=undefined;};
    a.retire=()=>{f.emit('world.afterEvents.playerLeave',{playerId:p.id});p.isValid=false;f.players.splice(f.players.indexOf(p),1);f.writes.length=0;f.particles.length=0;};
    return a;
  };
  lab.assertUsing=a=>{
    const row=a.sample('assert-using');
    assert.equal(row.profile,a.route.kind==='plain'?0:code[a.route.profile],JSON.stringify(row));
    assert.equal(row.handCode,a.route.kind==='plain'?0:a.hand==='off'?2:1,JSON.stringify(row));
    assert.equal(a.p[a.hand].amount,2);
    assert.equal(data.getItemProperty(a.p[a.hand],'foreign:timeline'),'retained');
    return row;
  };
  return lab;
}
