import {PLATE_CAPACITY,normalizePlateRows} from '../plate/plate_recipe_core.js';

export function skewerPlateHudView(rows=[]){
 const clean=normalizePlateRows(rows);
 const count=clean.length;
 const state=count===0?'empty':'take';
 const rawtext=[
  {text:'§6'},
  {translate:'jade.kaleidoscope_grilling.skewer_plate.count',with:[String(count),String(PLATE_CAPACITY)]},
  {text:'§r §8| §f'},
  {translate:'jade.kaleidoscope_grilling.skewer_plate.'+state}
 ];
 if(count>0)rawtext.push(
  {text:' §8| §7'},
  {translate:'jade.kaleidoscope_grilling.skewer_plate.pack'}
 );
 return {
  signature:['skewer_plate',count,...clean.map(x=>x.id)].join(':'),
  count,capacity:PLATE_CAPACITY,state,
  message:{rawtext}
 };
}
