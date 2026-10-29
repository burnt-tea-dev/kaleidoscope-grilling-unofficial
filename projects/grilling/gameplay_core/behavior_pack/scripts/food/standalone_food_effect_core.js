import {
 ROASTED_ID,WARMTH_EFFECT,WARMTH_TICKS,nextWarmthUntil
} from './roasted_sweet_potato_core.js';
import {
 COLD_ID,FIRE_RESISTANCE_TICKS
} from './cold_houttuynia_core.js';
import {
 WEDDING_CANDY_ID,WEDDING_CANDY_EFFECT,WEDDING_CANDY_EFFECT_TICKS
} from './wedding_candy_core.js';
import {pepperHoneyEffectRow} from './sugared_tomato_pepper_honey_core.js';
import {stockpotEffectRows} from './stockpot_food_core.js';
import {PERSISTED_KEY as PersistedKey} from '../core/persist_keys.js';

export const FX_KEY=PersistedKey.A21_FX;

const ROWS=Object.freeze([
 Object.freeze({
  itemId:ROASTED_ID,
  effects:Object.freeze([
   Object.freeze({
    kind:'persistent_fx',
    effect:WARMTH_EFFECT,
    ticks:WARMTH_TICKS,
    amplifier:0,
    stacking:'max_until'
   })
  ])
 }),
 Object.freeze({
  itemId:COLD_ID,
  effects:Object.freeze([
   Object.freeze({
    kind:'native',
    effect:'fire_resistance',
    ticks:FIRE_RESISTANCE_TICKS,
    options:Object.freeze({showParticles:true})
   })
  ])
 }),
 Object.freeze({
  itemId:WEDDING_CANDY_ID,
  effects:Object.freeze([
   Object.freeze({
    kind:'persistent_fx',
    effect:WEDDING_CANDY_EFFECT,
    ticks:WEDDING_CANDY_EFFECT_TICKS,
    amplifier:0,
    stacking:'max_until'
   })
  ])
 }),
 pepperHoneyEffectRow(),
 ...stockpotEffectRows()
]);

export function standaloneFoodEffectTable(){
 return ROWS.map(row=>({
  itemId:row.itemId,
  effects:row.effects.map(effect=>JSON.parse(JSON.stringify(effect)))
 }));
}

export function effectsForStandaloneFood(itemId){
 const row=ROWS.find(x=>x.itemId===String(itemId??''));
 return row?row.effects.map(effect=>JSON.parse(JSON.stringify(effect))):[];
}

export function nextPersistentUntil(nowTick,currentUntil,duration){
 return nextWarmthUntil(nowTick,currentUntil,duration);
}
