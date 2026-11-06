// Isolated diagnostic entry. Import production scripts unchanged beside it.
import {world,system,GameMode} from '@minecraft/server';
import {spawnSimulatedPlayer} from '@minecraft/server-gametest';
import {awardOneShotAdvancement} from './advancement/advancement_runtime.js';
import {MOUNTAIN_FRAGRANCE} from './advancement/advancement_core.js';
import {LOOKING_THE_PART,GLEAMING_WITH_OIL} from './advancement/advancement_event_core.js';

const wait=ticks=>new Promise(resolve=>system.runTimeout(resolve,ticks));
let started=false;
system.afterEvents.scriptEventReceive.subscribe(event=>{
 if(event.id!=='grilling_qa:advancement_claim'||started)return;
 started=true;
 observe().catch(error=>console.error('GRILLING_QA_FATAL '+error+' '+error?.stack));
});

async function observe(){
 const checks=[],samples=[];
 const check=(name,passed)=>{
  checks.push({name,passed:!!passed});
  console.warn('GRILLING_QA_CHECK '+JSON.stringify(checks.at(-1)));
  if(!passed)throw Error(name);
 };
 check('no external players in isolated QA',world.getAllPlayers().length===0);
 const dimension=world.getDimension('overworld');
 dimension.runCommand('fill -2 79 -2 2 79 2 stone');
 dimension.runCommand('fill -2 80 -2 2 83 2 air');
 let player;
 try{
  player=spawnSimulatedPlayer({dimension,x:.5,y:80,z:.5},'AdvancementClaimProbe',GameMode.Survival);
  await wait(3);
  const initialXp=player.getTotalXp();
  check('production advancement starts unclaimed',player.getDynamicProperty(MOUNTAIN_FRAGRANCE.propertyKey)===undefined);
  check('production award reports success',awardOneShotAdvancement(player,MOUNTAIN_FRAGRANCE)===true);
  const awardedXp=player.getTotalXp(),claim=player.getDynamicProperty(MOUNTAIN_FRAGRANCE.propertyKey);
  samples.push({case:'first award',beforeXp:initialXp,afterXp:awardedXp,claim});
  check('native total XP increases by the production twenty-five points',awardedXp===initialXp+25);
  check('native completed claim is boolean true',claim===true);
  check('duplicate production award is refused',awardOneShotAdvancement(player,MOUNTAIN_FRAGRANCE)===false);
  check('duplicate award leaves native XP and completed claim unchanged',player.getTotalXp()===awardedXp&&player.getDynamicProperty(MOUNTAIN_FRAGRANCE.propertyKey)===true);

  // Seed the existing production pending format, not a new recovery schema.
  // These are two possible prior XP outcomes; neither may be paid again.
  for(const [spec,alreadyPaid] of [[LOOKING_THE_PART,false],[GLEAMING_WITH_OIL,true]]){
   check(spec.id+' starts unclaimed',player.getDynamicProperty(spec.propertyKey)===undefined);
   const pending=JSON.stringify({version:1,state:'pending',xp:spec.xp});
   player.setDynamicProperty(spec.propertyKey,pending);
   const seedBeforeXp=player.getTotalXp();
   if(alreadyPaid)player.addExperience(spec.xp);
   const beforeXp=player.getTotalXp();
   if(alreadyPaid)check(spec.id+' prior XP outcome was applied natively',beforeXp===seedBeforeXp+spec.xp);
   check(spec.id+' native pending record readback',player.getDynamicProperty(spec.propertyKey)===pending);
   check(spec.id+' pending award is refused',awardOneShotAdvancement(player,spec)===false);
   await wait(2);
   const afterXp=player.getTotalXp(),afterClaim=player.getDynamicProperty(spec.propertyKey);
   samples.push({case:'existing pending',id:spec.id,alreadyPaid,beforeXp,afterXp,claim:afterClaim});
   check(spec.id+' pending does not replay XP or erase its record',afterXp===beforeXp&&afterClaim===pending);
  }
 }finally{
  player?.disconnect();
 }
 await wait(3);
 check('simulated Player disconnected',world.getAllPlayers().length===0);
 console.warn('GRILLING_QA_RESULT '+JSON.stringify({passed:true,phase:'advancement-claim',checks,samples,playersAfter:0,
  scope:'Unchanged awardOneShotAdvancement with actual production specs, native Player total XP and DP readback. Pending inputs are seeded with both prior XP outcomes. Not a gameplay trigger, script/server reload, unknown-write fault reproduction, cross-API atomicity, announcement/client rendering, or LIVE.'}));
}
