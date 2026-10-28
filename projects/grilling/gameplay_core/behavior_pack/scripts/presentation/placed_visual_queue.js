// Notification only: this module never owns or writes container contents.
export const dirtyPlacedVisuals=new Map();
export function visualLocationKey(dimensionId,l){return dimensionId+'|'+l.x+','+l.y+','+l.z}
export function markPlacedVisualDirty(block){
 try{
  const dimensionId=block.dimension.id,location={x:block.x,y:block.y,z:block.z};
  dirtyPlacedVisuals.set(visualLocationKey(dimensionId,location),{dimensionId,location});
 }catch{}
}
