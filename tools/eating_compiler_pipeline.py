"""Ordered post-base compiler stages; no pose or asset-ID decisions live here.

Source/donor reads remain owned by each compiler. Supplied output documents are
not disk fallbacks. Late imports preserve the existing historical module graph.
"""
from dataclasses import dataclass
from importlib import import_module
import json

@dataclass(frozen=True)
class Context:
 version: tuple
 table: dict
 rp: object
 main: object
 two_route_camera: bool=False
 review_three_routes: bool=True
 slime_frames: bool=True
 failure_skewers: bool=True

@dataclass(frozen=True)
class Stage:
 name: str
 module: str
 after: tuple=()
 gate: str='always'

STAGES=(
 Stage('java_projection','build_java_eating_projection',gate='modern'),
 Stage('secret_idle','secret_idle_calibration',('java_projection',)),
 Stage('secret_terminal','secret_terminal_visibility',('secret_idle',)),
 Stage('g126','build_caterpillar_eating_projection',('secret_terminal',),'g126'),
 Stage('g127','build_two_route_eating_projection',('g126',),'g127'),
 Stage('reviewed_three','build_review_three_eating_projection',('g127',),'review'),
 Stage('raw_one','build_raw_one_eating_projection',('reviewed_three',),'review'),
 Stage('failure','build_failure_skewer_held',('raw_one',),'failure'),
 Stage('partial_attachable','',('failure',)),
 Stage('owner_context','eating_owner_context',('partial_attachable',)),
 Stage('slime','build_slime_frame_selector',('owner_context',),'slime'),
 Stage('effects','effect_merge_source_witness',('slime',),'complete'),
 Stage('ordinary_relative','build_ordinary_relative_calibration',('effects',),'complete'),
 Stage('offhand','build_offhand_eating_projection',('ordinary_relative',),'complete'),
 Stage('performance','public_source_witness',('offhand',),'performance'),
 Stage('owner_properties','eating_owner_properties',('performance',),'owner_properties'),
 Stage('skewer_content','skewer_content_source',('owner_properties',),'skewer_content'),
)

def validate_stages(stages=None):
 stages=STAGES if stages is None else stages
 seen=set()
 for stage in stages:
  if stage.name in seen:raise ValueError('Duplicate compiler stage: '+stage.name)
  if not set(stage.after)<=seen:raise ValueError('Missing/out-of-order compiler prerequisite: '+stage.name)
  if stage.gate not in {'always','modern','g126','g127','review','failure','slime','complete','performance','owner_properties','skewer_content'}:raise ValueError('Unknown compiler gate: '+stage.gate)
  seen.add(stage.name)

def enabled(stage,c):
 return {'always':True,'modern':c.version>=(2,8,58),'g126':c.version>=(2,8,126),
  'g127':c.two_route_camera or c.version>=(2,8,127),'review':c.review_three_routes,
  'failure':c.failure_skewers,'slime':c.slime_frames,
  'complete':c.review_three_routes and c.slime_frames and c.failure_skewers,
  'performance':c.version>=(2,8,144) and c.review_three_routes and c.slime_frames and c.failure_skewers,
  'owner_properties':c.version>=(2,8,147) and c.review_three_routes and c.slime_frames and c.failure_skewers,
  'skewer_content':c.version in ((2,8,151),(2,8,152)) and c.review_three_routes and c.slime_frames and c.failure_skewers}[stage.gate]

def apply_stage(stage,output,c):
 if stage.name=='partial_attachable':
  partial=c.rp/'attachables/unfinished_skewer.attachable.json'
  if partial not in output and partial.is_file():
   from eating_owner_properties import predecessor_document
   output[partial]=predecessor_document(json.loads(partial.read_text()))
  return output
 module=import_module(stage.module)
 if stage.name=='performance':
  output[c.main]=module.apply_performance_source(output[c.main])
  return output
 if stage.name=='effects':
  # Retain the original live-source ownership check at its original stage.
  if 'mergeEffectApplication' in c.main.read_text():output[c.main]=module.reapply_main(output[c.main])
  return output
 if stage.name=='java_projection':return module.augment(output,c.table)
 return module.augment(output)

def run(output,context,*,resume_after=None):
 """Compose current stages, or the one reviewed G126 recomposition suffix.

Prerequisites express ordering, not forced activation: disabled stages remain
ordered checkpoints, preserving historical flag/version combinations exactly.
"""
 validate_stages()
 if resume_after not in (None,'g126'):raise ValueError('Unknown compiler checkpoint')
 if resume_after=='g126' and context.version<(2,8,126):raise ValueError('G126 checkpoint requires G126 version')
 start=0 if resume_after is None else next(i+1 for i,s in enumerate(STAGES)if s.name==resume_after)
 for stage in STAGES[start:]:
  if enabled(stage,context):output=apply_stage(stage,output,context)
 return output
