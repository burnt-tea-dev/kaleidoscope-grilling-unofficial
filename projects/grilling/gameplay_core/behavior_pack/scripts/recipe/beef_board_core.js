export const BOARD_ID='kaleidoscope_cookery:chopping_board';
export const BEEF_ID='minecraft:beef';
export const COOKERY_OFFAL_ID='kaleidoscope_cookery:raw_cow_offal';
export const BEEF_CHUNKS_ID='kaleidoscope_grilling:beef_chunks';
export const CUTS=4;
export const OUTPUT_COUNT=2;

export function stationKey(dimensionId,x,y,z){
 return `kc_station:${dimensionId}:${x},${y},${z}`;
}

export function canonicalBeefState(){
 return {
  input:BEEF_ID,
  cuts:0,
  max:CUTS,
  result:{id:BEEF_CHUNKS_ID,count:OUTPUT_COUNT},
  extension:false
 };
}

function validBeefBase(state){
 if(!state||state.input!==BEEF_ID)return false;
 const cuts=Number(state.cuts??0),max=Number(state.max??0),count=Number(state.result?.count??0);
 return Number.isFinite(cuts)&&cuts>=0&&cuts<=CUTS&&max===CUTS&&count===OUTPUT_COUNT;
}

export function classifyBoardState(state){
 if(!state||!state.input)return 'empty';
 if(!validBeefBase(state))return 'occupied';
 if(state.result?.id===COOKERY_OFFAL_ID)return 'builtin_beef';
 if(state.result?.id===BEEF_CHUNKS_ID)return 'canonical_beef';
 return 'occupied';
}

export function overrideBuiltInBeefState(state){
 if(classifyBoardState(state)!=='builtin_beef')return null;
 return {
  ...state,
  max:CUTS,
  result:{...(state.result??{}),id:BEEF_CHUNKS_ID,count:OUTPUT_COUNT},
  extension:false
 };
}

export function interactionDecision({blockId,state,mainId,eventId,isFirstEvent}){
 if(blockId!==BOARD_ID)return 'ignore';
 const kind=classifyBoardState(state);
 if(kind==='builtin_beef')return isFirstEvent===false?'cancel':'migrate';
 if(kind!=='empty')return 'ignore';
 if(mainId!==BEEF_ID)return 'ignore';
 if(eventId&&eventId!==BEEF_ID)return 'ignore';
 return isFirstEvent===false?'cancel':'insert';
}
