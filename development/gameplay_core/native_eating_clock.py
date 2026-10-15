"""Elapsed seconds from the active native countdown and captured use duration.

The item_* duration queries in tested 1.26.52.3 are not seconds. Do not divide
by a version-specific 400. Mainhand retains the native bow-family countdown
convention and owned start-event duration. Offhand uses replicated session
elapsed ticks, never the unrelated mainhand countdown. Offhand native-client
acceptance remains a separate gate.
"""
PROPERTY='kaleidoscope_grilling:eat_native_ticks'
TICKS="q.property('"+PROPERTY+"')"
SECONDS=("(q.is_using_item && "+TICKS+" > 0 ? math.clamp(("+TICKS+
         " - (q.main_hand_item_use_duration - q.frame_alpha + 1.0)) / 20.0, 0, "+TICKS+" / 20.0) : 0)")
VARIABLE='v.kg_eat_seconds'
# An observing client does not own the eater's main-hand countdown. Server
# presentation ticks are an entity property, not a dynamic item property, so
# Bedrock replicates them with the eater's profile and selected hand.
ELAPSED_PROPERTY='kaleidoscope_grilling:eat_elapsed_ticks'
ELAPSED_TICKS="q.property('"+ELAPSED_PROPERTY+"')"
OBSERVER_SECONDS=("("+TICKS+" > 0 && q.property('kaleidoscope_grilling:eat_hand') > 0 ? "
                  "math.clamp("+ELAPSED_TICKS+" / 20.0, 0, "+TICKS+" / 20.0) : 0)")
# The main-hand query is not an offhand clock. Reuse the owned replicated
# session time for offhand presentation, with immediate local cancellation.
# This is server-tick resolution; it is not native offhand interpolation proof.
OFF_HAND_SECONDS='(q.is_using_item ? '+OBSERVER_SECONDS+' : 0)'
SELECTED_HAND_SECONDS="(q.property('kaleidoscope_grilling:eat_hand') == 2 ? "+OFF_HAND_SECONDS+' : '+SECONDS+')'
VIEW_SECONDS='(c.is_first_person == 1 ? '+SELECTED_HAND_SECONDS+' : '+OBSERVER_SECONDS+')'
ASSIGNMENT=VARIABLE+' = '+VIEW_SECONDS+';'
