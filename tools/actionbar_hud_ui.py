"""Bounded graphical instances from the original native actionbar factory event."""
def install_actionbar_factory(hud, owner, variable, prefix, end, lifetime):
    name='kt_mixology' if owner=='tavern' else 'kg_eating'
    namespace=hud['namespace'];packet=hud[name+'_packet']
    packet.update({'$'+variable:'$actionbar_text','visible':f"(not ((${variable} - '{prefix}') = ${variable}) and (not (${variable} = '{end}')))",
                   'alpha':'@'+namespace+'.'+name+'_expire','propagate_alpha':True})
    hud[name+'_expire']={'anim_type':'alpha','duration':lifetime,'from':1,'to':1,'destroy_at_end':name+'_packet'}
    hud[name+'_factory']={'type':'panel','size':['100%','100%'],'factory':{'name':'hud_actionbar_text_factory','max_children_size':1,
                'control_ids':{'hud_actionbar_text':name+'_packet@'+namespace+'.'+name+'_packet'}}}
    root=hud['root'];root['controls']=[r for r in root['controls'] if 'channel_root_probe' not in r]
    root['controls'][0]={( 'kt_mixology' if owner=='tavern' else 'kg_java_eating')+'@'+namespace+'.'+name+'_factory':{}}
