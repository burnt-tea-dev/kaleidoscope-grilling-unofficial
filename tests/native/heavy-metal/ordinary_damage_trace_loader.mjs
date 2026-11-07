// Unit-fidelity boundary only; never installed in BDS or a game pack.
let configuration;
export function initialize(data){configuration=data;}
export async function resolve(specifier,context,nextResolve){
 const parent=context.parentURL&&new URL(context.parentURL);
 if(specifier==='../ordinary_damage_trace.js'&&parent?.searchParams.get('fixture')===String(configuration.fixtureId)){
  const url=new URL('./ordinary_damage_trace.js',import.meta.url);
  url.searchParams.set('fixture',configuration.fixtureId);
  return {url:url.href,shortCircuit:true};
 }
 return nextResolve(specifier,context);
}
export async function load(url,context,nextLoad){
 const target=new URL(url);
 if(target.pathname===configuration.target&&target.searchParams.get('fixture')===String(configuration.fixtureId)){
  return {format:'module',source:configuration.source,shortCircuit:true};
 }
 return nextLoad(url,context);
}
