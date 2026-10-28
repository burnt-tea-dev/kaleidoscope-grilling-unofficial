import {
 CROP_ID as CANOLA_CROP_ID,
 SEEDS_ID as CANOLA_OUTPUT_ID,
 COMPONENT_ID as CANOLA_COMPONENT_ID,
 AGE_STATE as CANOLA_AGE_STATE,
 MAX_AGE as CANOLA_MAX_AGE
} from './canola_crop_core.js';
import {
 CROP_ID as ONION_CROP_ID,
 ONION_ID as ONION_OUTPUT_ID,
 COMPONENT_ID as ONION_COMPONENT_ID,
 AGE_STATE as ONION_AGE_STATE,
 MAX_AGE as ONION_MAX_AGE
} from './onion_crop_core.js';
import {
 CROP_ID as SWEET_POTATO_CROP_ID,
 SWEET_POTATO_ID as SWEET_POTATO_OUTPUT_ID,
 COMPONENT_ID as SWEET_POTATO_COMPONENT_ID,
 AGE_STATE as SWEET_POTATO_AGE_STATE,
 MAX_AGE as SWEET_POTATO_MAX_AGE
} from './sweet_potato_crop_core.js';

const CROPS=Object.freeze([
 Object.freeze({
  key:'canola',
  cropId:CANOLA_CROP_ID,
  outputId:CANOLA_OUTPUT_ID,
  componentId:CANOLA_COMPONENT_ID,
  ageState:CANOLA_AGE_STATE,
  maxAge:CANOLA_MAX_AGE,
  matureRandomDraws:2
 }),
 Object.freeze({
  key:'onion',
  cropId:ONION_CROP_ID,
  outputId:ONION_OUTPUT_ID,
  componentId:ONION_COMPONENT_ID,
  ageState:ONION_AGE_STATE,
  maxAge:ONION_MAX_AGE,
  matureRandomDraws:2
 }),
 Object.freeze({
  key:'sweet_potato',
  cropId:SWEET_POTATO_CROP_ID,
  outputId:SWEET_POTATO_OUTPUT_ID,
  componentId:SWEET_POTATO_COMPONENT_ID,
  ageState:SWEET_POTATO_AGE_STATE,
  maxAge:SWEET_POTATO_MAX_AGE,
  matureRandomDraws:3
 })
]);

export function farmlandCropTable(){
 return CROPS.map(x=>({...x}));
}

export function farmlandCropByKey(key){
 const row=CROPS.find(x=>x.key===String(key??''));
 return row?{...row}:undefined;
}
