"""Owned factory snapshots, with a prefix latch used only for bounded stop events."""
def capture(prefix,packet):
 return {'type':'panel','size':[0,0],'property_bag':{packet:''},'bindings':[
  {'binding_name':'#hud_title_text_string','binding_type':'global'},
  {'binding_name':'#hud_title_text_string','binding_name_override':packet,'binding_type':'global','binding_condition':'visibility_changed'},
  {'binding_type':'view','source_property_name':f"(not (#hud_title_text_string = {packet}) and (('%.{len(prefix.encode("utf-8"))}s' * #hud_title_text_string) = '{prefix}'))",'target_property_name':'#visible'}]}
def snapshot_panel(panel,kind,prefix,end,variable):
 frame=kind+'_frame';channel=kind+'_channel';text='#'+variable;latest=text+'_latest'
 frame_control={'type':'panel','size':[0,0],'property_bag':{text:''},'bindings':[{'binding_name':'#hud_title_text_string','binding_name_override':text,'binding_type':'global','binding_condition':'once'}]}
 for row in panel['controls']:
  for name,image in row.items():
   expression=image.pop('visible','true').replace('$'+variable,text)
   image['property_bag']={text:'',latest:''}
   image['bindings']=[
    {'binding_type':'view','source_control_name':frame,'resolve_sibling_scope':True,'source_property_name':text,'target_property_name':text},
    {'binding_type':'view','source_control_name':channel,'resolve_sibling_scope':True,'source_property_name':latest,'target_property_name':latest},
    {'binding_type':'view','source_property_name':f"({expression} and (({latest} = '') or ({latest} = {text})) and (not ({latest} = '{end}')))",'target_property_name':'#visible'}]
 panel['controls'] += [{frame:frame_control},{channel:capture(prefix,latest)}]
def packet_visibility(packet,variable,prefix,end):
 text='#'+variable
 packet.pop('$'+variable,None);packet.pop('visible',None)
 packet['property_bag']={text:''}
 packet['bindings']=[{'binding_name':'#hud_title_text_string','binding_name_override':text,'binding_type':'global','binding_condition':'once'},
 {'binding_type':'view','source_property_name':f"((('%.{len(prefix.encode("utf-8"))}s' * {text}) = '{prefix}') and (not ({text} = '{end}')))",'target_property_name':'#visible'}]
