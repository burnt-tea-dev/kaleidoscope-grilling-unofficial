"""Manual-only HUD probes, independent of the graphics' cached visibility.

Normal packets never contain D;, so these controls remain hidden in gameplay.
MOUNT reads the title at the native bridge; ROOT reads it in an owned catalog;
CACHE reads the actual channel cache beside the graphics. They certify nothing
without a real player's observation.
"""
PREFIXES = ('KT_HUD!', 'KG_HUD!')

def contains(text, token):
    return f"(not (({text} - '{token}') = {text}))"

def probe_label(label, offset, prefix=None, channel=None, packet=None):
    raw = packet if channel else '#hud_title_text_string'
    gate = ' or '.join(contains(raw, p+'D;') for p in ([prefix] if prefix else PREFIXES))
    bindings = ([{'binding_type':'view','source_control_name':channel,
                  'resolve_sibling_scope':True,'source_property_name':packet,
                  'target_property_name':packet,'binding_condition':'always'}]
                if channel else [{'binding_name':'#hud_title_text_string',
                                  'binding_type':'global','binding_condition':'always'}])
    bindings.append({'binding_type':'view','source_property_name':f'({gate})',
                     'target_property_name':'#visible','binding_condition':'always'})
    return {'type':'label','text':label,'size':[110,12],'anchor_from':'top_middle',
            'anchor_to':'top_middle','offset':offset,'layer':100,
            'color':[1,1,1],'shadow':True,'localize':False,'bindings':bindings,
            **({'property_bag':{packet:''}} if channel else {})}

def install_catalog_probe(hud, owner, panel, channel, packet):
    prefix = PREFIXES[0 if owner=='tavern' else 1]
    name = 'KT' if owner=='tavern' else 'KG'
    hud['root']['controls'] = [r for r in hud['root']['controls'] if 'channel_root_probe' not in r]
    hud['root']['controls'].append({'channel_root_probe':probe_label(name+' ROOT',[-62 if owner=='tavern' else 62,92])})
    panel['controls'] = [r for r in panel['controls'] if 'channel_cache_probe' not in r]
    # Retain the last cache control used by the existing image contract.
    panel['controls'].insert(len(panel['controls'])-1, {'channel_cache_probe':
        probe_label(name+' CACHE',[0,80] if owner=='tavern' else [62,110],prefix,channel,packet)})

def install_bridge_probe(hud):
    values= hud['root_panel']['modifications'][0]['value']
    values[:] = [r for r in values if 'kt_family_probe@hud.kt_family_probe' not in r]
    values.append({'kt_family_probe@hud.kt_family_probe':{}})
    hud['kt_family_probe']=probe_label('UI MOUNT',[0,76])
    # Preserve ordinary titles and foreign controls; suppress only owned data.
    hud['hud_title_text']={'bindings':[
        {'binding_name':'#hud_title_text_string','binding_type':'global','binding_condition':'always'},
        {'binding_type':'view','source_property_name':f"(not ({' or '.join(contains('#hud_title_text_string',p) for p in PREFIXES)}))",
         'target_property_name':'#visible','binding_condition':'always'}]}
