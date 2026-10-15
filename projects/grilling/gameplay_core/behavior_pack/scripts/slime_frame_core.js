// Java ClientSetup: floor(level.getGameTime()/4)%5, independent of eating.
// Reduce the safe Script integer BEFORE client float32 transport.
export const SLIME_ID='kaleidoscope_grilling:grilled_slime_skewer';
export const SLIME_FRAME_MARKER_MIN=215;
export const SLIME_FRAME_MARKER_MAX=219;
export function slimeFrameAtTick(tick){return Number.isSafeInteger(tick)&&tick>=0?Math.floor(tick/4)%5:0;}
export function readSlimeWorldFrame(world){try{return slimeFrameAtTick(world.getAbsoluteTime())}catch{return 0}}
export function slimeFramePacket(frame){
 if(!Number.isInteger(frame)||frame<0||frame>4)throw Error('Grilling: invalid slime frame');
 return [...Array(11).fill(0),SLIME_FRAME_MARKER_MIN+frame];
}
export function decodeSlimeFrame(typeId,marker){
 return typeId===SLIME_ID&&Number.isInteger(marker)&&marker>=SLIME_FRAME_MARKER_MIN&&marker<=SLIME_FRAME_MARKER_MAX?marker-SLIME_FRAME_MARKER_MIN:0;
}
