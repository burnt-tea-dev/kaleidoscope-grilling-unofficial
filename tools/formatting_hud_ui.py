"""Persistent, channel-local title receivers; no title factory or creation snapshot.

The zero-duration transport updates a binding, not a visible title's lifetime.
Keep the receiver mounted and retain only this channel's packets. The sender
supplies an owned terminal packet on stop and on missed refresh.
"""
def contains(text, fragment):
 return f"(not (({text} - '{fragment}') = {text}))"

def capture(prefix, packet):
 return {'type':'panel','size':[0,0],'visible':False,'property_bag':{packet:''},'bindings':[
  {'binding_name':'#hud_title_text_string','binding_type':'global','binding_condition':'always'},
  {'binding_name':'#hud_title_text_string','binding_name_override':packet,'binding_type':'global','binding_condition':'visibility_changed'},
  {'binding_type':'view','source_property_name':f"(not (#hud_title_text_string = {packet}) and {contains('#hud_title_text_string',prefix)})",'target_property_name':'#visible','binding_condition':'always'}]}

def bind_channel(panel, kind, prefix, end, variable):
 channel=kind+'_channel';text='#'+variable
 for row in panel['controls']:
  for image in row.values():
   expression=image.pop('visible','true').replace('$'+variable,text)
   image['property_bag']={text:''}
   image['bindings']=[
    {'binding_type':'view','source_control_name':channel,'resolve_sibling_scope':True,'source_property_name':text,'target_property_name':text,'binding_condition':'always'},
    {'binding_type':'view','source_property_name':f"({expression} and {contains(text,prefix)} and (not ({text} = '{end}')))",'target_property_name':'#visible','binding_condition':'always'}]
 panel['controls'].append({channel:capture(prefix,text)})
