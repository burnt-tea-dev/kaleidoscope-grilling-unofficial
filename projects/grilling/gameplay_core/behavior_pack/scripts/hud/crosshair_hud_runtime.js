// Passive crosshair HUD retired in A2.8.3. Registration stays as a no-op so
// optional diagnostic providers do not poll players or publish actionbars.
export function registerCrosshairHudProvider({id,probe}={}){
 return !!id&&typeof probe==='function';
}
