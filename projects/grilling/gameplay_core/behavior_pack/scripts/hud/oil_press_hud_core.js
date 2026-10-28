import {
 PRESS_MAX_CAKES,PRESS_REQUIRED_PROGRESS,VAT_CAPACITY_BUCKETS,normalizePress,normalizeVat
} from '../oil/oil_machine_core.js';

function vatHud(probe={}){
 const status=String(probe.status??'NO_CONTAINER').toUpperCase();
 const vat=normalizeVat(probe.vat??{});
 if(status==='INCOMPATIBLE')
  return {status,signature:'incompatible:'+vat.type+':'+vat.buckets,message:{translate:'hud.kaleidoscope_grilling.press.vat.wrong'}};
 if(status==='FULL')
  return {
   status,signature:'full:'+vat.type+':'+vat.buckets,
   message:{translate:'hud.kaleidoscope_grilling.press.vat.full',with:[String(vat.buckets),String(VAT_CAPACITY_BUCKETS)]}
  };
 if(status==='SUCCESS')
  return {
   status,signature:'ready:'+vat.type+':'+vat.buckets,
   message:{translate:'hud.kaleidoscope_grilling.press.vat.found',with:[String(vat.buckets),String(VAT_CAPACITY_BUCKETS)]}
  };
 return {status:'NO_CONTAINER',signature:'none',message:{translate:'hud.kaleidoscope_grilling.press.vat.none'}};
}

export function oilPressHudView(state={},probe={}){
 const s=normalizePress(state),vat=vatHud(probe);
 return {
  signature:['oil_press',s.cakes,s.progress,s.waiting?1:0,vat.signature].join(':'),
  cakes:s.cakes,progress:s.progress,waiting:s.waiting,vatStatus:vat.status,
  message:{rawtext:[
   {text:'§6'},
   {translate:'hud.kaleidoscope_grilling.press.title'},
   {text:'§r §8| §f'},
   {translate:'hud.kaleidoscope_grilling.press.cakes',with:[String(s.cakes),String(PRESS_MAX_CAKES)]},
   {text:' §8| §7'},
   {translate:'hud.kaleidoscope_grilling.press.progress',with:[String(s.progress),String(PRESS_REQUIRED_PROGRESS)]},
   {text:' §8| §f'},
   vat.message
  ]}
 };
}
