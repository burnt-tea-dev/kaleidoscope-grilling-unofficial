# Shared HUD catalog repair

The owner reported missing or incompatible eating progress on the full server
pack stack. G126's separate no-clear trial rendered the eating bar, while its
status page explicitly retained the missing LIVE HUD as an unresolved defect.
That narrow recording did not accept the merged family or natural eating.

Before this repair, all 405 eating sprite states, their packet lifetime and the
native root insertion lived only in Grilling's `ui/hud_screen.json`. Tavern,
A Magic Way and Java Saturation also customize that catalog. Tavern and Grilling
declared different `hud.root_panel.modifications` and different native actionbar
filters. Whichever shared catalog definitions are selected must not remove the
other port's controls or leave an unresolved cross-pack reference.

Microsoft documents UI files as catalog customizations, with partial snippets
instead of a full vanilla file replacement, and requires `_ui_defs.json` to
register custom UI files:
[catalog customization](https://learn.microsoft.com/en-us/minecraft/creator/documents/overwritingassets?view=minecraft-bedrock-stable),
[UI definitions](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/jsonuireference/examples/jsonuicomponents/ui_defs?view=minecraft-bedrock-stable).
These references support the loading and customization mechanism, not a claim
that a static check reproduces every client's catalog merge behavior.

## Implemented closure

Grilling registers its complete eating controls independently in
`ui/kg_grilling_hud.json`, namespace `kaleidoscope_grilling_hud`. Its own global
`$kg_grilling_hud_root` points to the typed root in that catalog. The shared native
`ui/hud_screen.json` now contains only the generic empty panel, one additive
insertion mounting optional Tavern and Grilling roots, and the joint native
actionbar text filter. Tavern ships the exact same generic mount file. Absent
optional roots default to the empty panel, so Grilling does not require Tavern's
private control definitions to load on its own.

No vanilla root controls or native bindings are copied or replaced. No Java
Saturation or A Magic Way script/UI file is altered by this owned repair. The
shared filter retains their existing `!js.` packet suppression alongside the
Tavern and Grilling transport prefixes.

The original base, all 204 progress crops and all 200 icon states are unchanged.
The 102×5 bar, 16×16 icons, original yellow and green pixels, 25-tick checkpoint,
90/100-tick progress, packet producer, 100 ms hold and 1 ms owned expiry are
unchanged. Only own UI namespace references and the registration/mount location
move. Item animation, settlement, inventory, seasoning, dependencies and saved
ownership receive no behavior change from this repair. There is no shared
actionbar clear, ASCII bar, extra poll loop or new reminder.

## Verification and limits

The existing focused HUD suite passes, including a static regression requiring
the registered Grilling catalog and complete optional mount closure. The existing
atlas suite still checks exact original pixels, every crop and the actual
authoring generator's committed UI bytes. Source comparison with G128 confirms
that all five owned UI definitions remain equivalent after the namespace rename.

These are source and asset checks. They do not certify a rendered client, native
catalog resolution, natural eating, cancellation, repeated eating, slot changes,
touch/Classic/Pocket layouts, different screen scale, or an arbitrary higher
priority third-party HUD replacement. Full-family BDS/save verification and
current-candidate client evidence remain separate.

Other scripts still share the native actionbar transport. A foreign writer can
replace the most recent frame; this is a separate timing/ownership concern.
Its role in the user's actual failure is not confirmed, so this repair does not
reroute title packets, arbitrarily extend lifetime, alter Java timing, or suppress
the other addon. The common catalog repair must be tested with the actual full
pack stack, and remaining channel conflicts must be diagnosed from that result.
