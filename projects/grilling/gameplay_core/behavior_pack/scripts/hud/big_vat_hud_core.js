import {VAT_CAPACITY_BUCKETS,normalizeVat} from '../oil/oil_machine_core.js';

export function bigVatContentKey(type){
 const t=String(type??'');
 return 'hud.kaleidoscope_grilling.vat.content.'+(t||'empty');
}

export function bigVatHudView(state={}){
 const v=normalizeVat(state);
 const type=v.type||'';
 const buckets=v.buckets;
 return {
  signature:['big_vat',type||'empty',buckets,VAT_CAPACITY_BUCKETS].join(':'),
  type,buckets,capacity:VAT_CAPACITY_BUCKETS,
  message:{rawtext:[
   {text:'§6'},
   {translate:'hud.kaleidoscope_grilling.vat.title'},
   {text:'§r §8| §f'},
   {translate:bigVatContentKey(type)},
   {text:' §8| §7'},
   {translate:'hud.kaleidoscope_grilling.vat.capacity',with:[String(buckets),String(VAT_CAPACITY_BUCKETS)]},
   {text:' §8| §7'},
   {translate:'hud.kaleidoscope_grilling.vat.accepts'}
  ]}
 };
}
