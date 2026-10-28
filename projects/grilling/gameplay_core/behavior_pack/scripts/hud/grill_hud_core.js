import {
 FINISHED_TICKS,BURNT_TICKS,REQUIRED_FLIPS,normalizeState
} from '../core_logic.js';

export const GRILL_HUD_TIMER_STEP=20;

function timerMax(state){
 return state.phase<=2?FINISHED_TICKS:BURNT_TICKS;
}

function statusMessage(status,state){
 if(status==='jade.kaleidoscope_grilling.grill.ready')
  return {translate:'message.kaleidoscope_grilling.grill_ready_to_take'};
 return (status==='jade.kaleidoscope_grilling.grill.flipping'||status==='jade.kaleidoscope_grilling.grill.need_flip')
  ?{translate:status,with:[String(state.flips),String(REQUIRED_FLIPS)]}
  :{translate:status};
}

export function grillHudStatusKey(state={},occupied=0){
 const s=normalizeState(state),n=Math.max(0,Math.floor(Number(occupied)||0));
 if(!s.lit)return 'jade.kaleidoscope_grilling.grill.need_heat';
 if(n===0)return 'jade.kaleidoscope_grilling.grill.empty';
 if(s.phase===0)return 'jade.kaleidoscope_grilling.grill.need_oil';
 if(s.phase===1)return s.flipCooldown>0
  ?'jade.kaleidoscope_grilling.grill.flipping'
  :'jade.kaleidoscope_grilling.grill.need_flip';
 if(s.phase===2)return s.seasoned
  ?'jade.kaleidoscope_grilling.grill.ready'
  :'jade.kaleidoscope_grilling.grill.need_seasoning';
 return 'jade.kaleidoscope_grilling.grill.burning';
}

export function grillHudView(state={},occupied=0){
 const s=normalizeState(state),n=Math.max(0,Math.min(3,Math.floor(Number(occupied)||0)));
 const max=timerMax(s);
 const phaseTicks=Math.max(0,Math.min(max,Math.floor(Number(s.phaseTicks)||0)));
 const shownTicks=n>0?Math.floor(phaseTicks/GRILL_HUD_TIMER_STEP)*GRILL_HUD_TIMER_STEP:0;
 const status=grillHudStatusKey(s,n);
 const rawtext=[
  {text:'§c'},
  {translate:'hud.kaleidoscope_grilling.grill.title'},
  {text:'§r §8| §f'},
  statusMessage(status,s)
 ];
 if(n>0){
  rawtext.push(
   {text:' §8| §7'},
   {translate:'hud.kaleidoscope_grilling.grill.timer',with:[String(shownTicks),String(max)]}
  );
 }
 rawtext.push(
  {text:' §8| §7'},
  {translate:'hud.kaleidoscope_grilling.grill.flips',with:[String(s.flips),String(REQUIRED_FLIPS)]},
  {text:' §8| §7'},
  {translate:'hud.kaleidoscope_grilling.grill.seasoning.'+(s.seasoned?'added':'none')}
 );
 return {
  signature:[
   'grill',status,n,shownTicks,max,s.flips,s.flipCooldown>0?1:0,s.seasoned?1:0
  ].join(':'),
  status,occupied:n,shownTicks,max,flips:s.flips,seasoned:s.seasoned,
  message:{rawtext}
 };
}
