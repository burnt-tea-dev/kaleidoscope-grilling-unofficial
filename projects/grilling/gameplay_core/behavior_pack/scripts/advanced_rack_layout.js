/** Owner-requested direct rack adaptation. Slot indices remain saved-world ABI:
 * five seasonings (0..4), four tools (5..8). Display never compacts occupied slots.
 * Geometry generation and interaction use these same rack-local cell centers.
 */
export const RACK_HALF_WIDTH=7/16;
export const RACK_ROW_BOUNDARY=9/16;
export const RACK_TOOL_ROW_MIN=5/16;
// Front selection face of the north rack, measured from the block center.
// Keep displayed tools on this plane: a forward offset makes oblique aim rays
// cross another saved cell before they reach the block's selection box.
export const RACK_TOOL_VISUAL_Z=3/16;
export const RACK_TOOL_VISUAL_Y=(RACK_TOOL_ROW_MIN+RACK_ROW_BOUNDARY)/2;
// Half a source pixel of total clearance inside each fitted tool cell.
export const RACK_TOOL_VISUAL_GAP=.5/16;
// Each Bedrock custom state has at most 16 values: low four bits plus slot 4.
export const RACK_OCCUPANCY_STATE='kaleidoscope_grilling:seasoning_occupancy';
export const RACK_OCCUPANCY_HIGH_STATE='kaleidoscope_grilling:seasoning_occupancy_high';
const centers=count=>Object.freeze(Array.from({length:count},(_,i)=>-RACK_HALF_WIDTH+(i+.5)*2*RACK_HALF_WIDTH/count));
export const RACK_SEASONING_X=centers(5);
export const RACK_TOOL_X=centers(4);
export const RACK_FACING_ANGLE=Object.freeze({north:0,east:90,south:180,west:270});

export function rackLocalHit(direction,hit){
 if(!Object.hasOwn(RACK_FACING_ANGLE,direction)||!hit||![hit.x,hit.y,hit.z].every(Number.isFinite))return undefined;
 if(hit.x<0||hit.x>1||hit.z<0||hit.z>1)return undefined;
 const x=hit.x-.5,z=hit.z-.5;
 // Exact cardinal values avoid floating-point boundary drift on E/W faces.
 const localX=direction==='south'?-x:direction==='east'?z:direction==='west'?-z:x;
 return {x:localX,y:hit.y};
}

export function rackSlotAtLocalHit(hit){
 if(!hit||!Number.isFinite(hit.x)||!Number.isFinite(hit.y)||Math.abs(hit.x)>RACK_HALF_WIDTH||hit.y<RACK_TOOL_ROW_MIN||hit.y>14/16)return -1;
 const top=hit.y>=RACK_ROW_BOUNDARY,count=top?5:4;
 const index=Math.min(count-1,Math.floor((hit.x+RACK_HALF_WIDTH)/(2*RACK_HALF_WIDTH)*count));
 return (top?0:5)+index;
}

export function rackDisplayPose(block,x,y,z){
 const direction=block.permutation.getState('minecraft:cardinal_direction');
 if(!Object.hasOwn(RACK_FACING_ANGLE,direction))throw new Error('Unknown rack facing');
 const dx=direction==='south'?-x:direction==='east'?-z:direction==='west'?z:x;
 const dz=direction==='south'?-z:direction==='east'?x:direction==='west'?-x:z;
 return {location:{x:block.x+.5+dx,y:block.y+y,z:block.z+.5+dz},angle:RACK_FACING_ANGLE[direction]};
}

export function rackSeasoningOccupancy(readItem){
 let mask=0;for(let slot=0;slot<5;slot++)if(readItem(slot))mask+=2**slot;
 return mask;
}
