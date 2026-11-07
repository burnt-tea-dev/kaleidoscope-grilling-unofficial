// QA admission only. API true is deliberately absent from these conditions.
export function plainKillGate(row){
 const events=row.events??[],id=row.before?.id;
 const aliveInput=row.before?.valid===true&&row.before.health>0;
 const deathObserved=events.some(event=>event.event==='death'&&event.id===id);
 const positiveBeforeHurt=events.some(event=>event.event==='beforeHurt'&&event.id===id&&event.damage>0);
 const totemUntouched=row.before?.off?.id==='minecraft:totem_of_undying'&&row.before.off.amount===1&&
  row.after?.off?.id===row.before.off.id&&row.after.off.amount===1&&!events.some(event=>event.event==='heal'&&event.totem);
 const conditions={aliveInput,deathObserved,positiveBeforeHurt,totemUntouched};
 return {...conditions,eligible:Object.values(conditions).every(Boolean),
  missing:Object.keys(conditions).filter(key=>!conditions[key])};
}
