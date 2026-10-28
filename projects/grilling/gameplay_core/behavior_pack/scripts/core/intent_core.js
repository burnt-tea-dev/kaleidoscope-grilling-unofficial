export function makeTwoHandIntent(main,off,slot,dimensionId,sneaking){
 if(!Number.isInteger(slot)||slot<0||typeof dimensionId!=='string')return null;
 return {main:main??null,off:off??null,slot,dimensionId,sneaking:!!sneaking};
}
export function sameTwoHandIntent(expected,current){
 return !!expected&&!!current&&expected.slot===current.slot
  &&expected.dimensionId===current.dimensionId&&expected.sneaking===current.sneaking
  &&expected.main===current.main&&expected.off===current.off;
}
