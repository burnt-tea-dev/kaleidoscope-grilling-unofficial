/** Keep every host admission gate consistent with its existing recipe loader. */
export function admitPublicMillstoneInput(id,builtins,extensionForInput){
 return !!id&&!!(builtins[id]||extensionForInput(id)?.outputs);
}
