"""Optional UI providers belong in the global scope, never local defaults.

Local template defaults shadow global providers. Keep absent-addon fallbacks
in the same global catalog as providers; explicit owner entries override the
fallbacks without redefining any native screen or optional addon control.
This is a structural contract, not a Bedrock renderer.
"""
EMPTY='hud.kt_family_empty'
PROVIDERS=(
 '$kt_tavern_hud_root','$kg_grilling_hud_root',
 '$senluo_amw_hud_root','$senluo_amw_boss_root',
 '$senluo_saturation_non_centered','$senluo_saturation_centered','$senluo_saturation_touch',
 '$kt_world_liquor_effect_panel',
)

def global_catalog(owner):
 result={key+'|default':EMPTY for key in PROVIDERS}
 key,value={'tavern':('$kt_tavern_hud_root','kaleidoscope_tavern_hud.root'),
            'grilling':('$kg_grilling_hud_root','kaleidoscope_grilling_hud.root')}[owner]
 result[key]=value
 return result

def reject_local_provider_defaults(value):
 if isinstance(value,dict):
  for key,child in value.items():
   assert key.removesuffix('|default') not in PROVIDERS, 'Local HUD variable shadows global provider: '+key
   reject_local_provider_defaults(child)
 elif isinstance(value,list):
  for child in value:reject_local_provider_defaults(child)

def resolve_global_catalog(catalog):
 # Validate the declared fallback/provider contract, not runtime rendering.
 result={key.removesuffix('|default'):value for key,value in catalog.items() if key.endswith('|default')}
 result.update({key:value for key,value in catalog.items() if not key.endswith('|default')})
 return result
