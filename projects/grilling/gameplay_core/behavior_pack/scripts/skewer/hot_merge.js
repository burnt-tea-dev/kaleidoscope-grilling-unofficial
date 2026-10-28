export const NORMAL_HEAT_WINDOW=5*60*20;

export function weightedHeat(targetRemaining,targetCount,sourceRemaining,moved){
  if(!Number.isFinite(targetRemaining)||!Number.isFinite(sourceRemaining)||targetCount<1||moved<1)throw new Error('invalid heat merge');
  return Math.floor((Math.max(0,targetRemaining)*targetCount+Math.max(0,sourceRemaining)*moved)/(targetCount+moved));
}
export function normalHeatCompatible(a,b){
  if(a.hot!==b.hot)return false;
  if(!a.hot)return true;
  return Math.abs(a.remaining-b.remaining)<=NORMAL_HEAT_WINDOW;
}
export function fullHeatCompatible(a,b){return true;}
export function compactGroups(rows,fullSort=false,maxStack=64){
  const groups=[];
  for(const row of rows){
    if(!row||row.count<1)continue;
    let g=groups.find(x=>x.key===row.key&&(fullSort?fullHeatCompatible(x,row):normalHeatCompatible(x,row)));
    if(!g){g={key:row.key,hot:row.hot,remaining:row.remaining,totalCount:0,totalHeat:0};groups.push(g);}
    g.totalCount+=row.count;g.totalHeat+=Math.max(0,row.remaining)*row.count;
    if(!g.hot&&row.hot)g.hot=true;
  }
  const out=[];
  for(const g of groups){
    const avg=g.totalCount?Math.floor(g.totalHeat/g.totalCount):0;
    let left=g.totalCount;
    while(left>0){const count=Math.min(maxStack,left);out.push({key:g.key,count,hot:avg>0,remaining:avg});left-=count;}
  }
  return out;
}
