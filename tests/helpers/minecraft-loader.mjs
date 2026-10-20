/** Resolve the Minecraft API boundary without changing any runtime source. */
const scripts = new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/', import.meta.url);
const server = new URL('./minecraft-server.mjs', import.meta.url);
export async function resolve(specifier, context, nextResolve) {
  const fixture = context.parentURL && new URL(context.parentURL).searchParams.get('fixture');
  if (specifier === '@minecraft/server') {
    const url = new URL(server);
    url.searchParams.set('fixture', fixture ?? 'default');
    return {url: url.href, shortCircuit: true};
  }
  const result = await nextResolve(specifier, context);
  if (result.url.startsWith(scripts.href)) {
    const url = new URL(result.url);
    url.searchParams.set('fixture', fixture ?? url.searchParams.get('fixture') ?? 'default');
    return {...result, url: url.href};
  }
  return result;
}
