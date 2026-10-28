function emptyDescriptor(){return {empty:true,id:null,sig:null}}

export function chooseInteractionHand(eventDesc,mainDesc,offDesc){
 const e=eventDesc??emptyDescriptor(),m=mainDesc??emptyDescriptor(),o=offDesc??emptyDescriptor();
 if(e.empty){
  if(m.empty)return 'main';
  if(o.empty)return 'off';
  return 'main';
 }
 const mainExact=!m.empty&&e.sig!==null&&e.sig===m.sig;
 const offExact=!o.empty&&e.sig!==null&&e.sig===o.sig;
 if(offExact&&!mainExact)return 'off';
 if(mainExact&&!offExact)return 'main';
 const mainType=!m.empty&&e.id===m.id;
 const offType=!o.empty&&e.id===o.id;
 if(offType&&!mainType)return 'off';
 return 'main';
}

export function makeIntent(hand,signature,selectedSlot){
 return {
  hand:hand==='off'?'off':'main',
  signature:signature??null,
  selectedSlot:Number.isInteger(selectedSlot)?selectedSlot:0
 };
}

export function intentMatches(intent,currentMainSig,currentOffSig,currentSelectedSlot){
 if(!intent)return false;
 if(intent.hand==='off')return (currentOffSig??null)===(intent.signature??null);
 return Number(currentSelectedSlot)===Number(intent.selectedSlot)
   &&(currentMainSig??null)===(intent.signature??null);
}
