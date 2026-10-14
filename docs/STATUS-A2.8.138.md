# Grilling A2.8.138

The owner reports that holding use on touch produces no eating motion. The inspected saved serving is a normal grilled caterpillar skewer without invalid metadata. The previous HUD releases did not change its food/use definition or eating event handlers; the exact runtime cause is not yet client-confirmed.

Declare the native touch interaction action explicitly for edible skewers, including alternate and plain native-use identities. The action uses the game's default localized use label and its existing native food/use route. Nutrition, duration, saturation, tags, effects, native completion/debit, animations, quantities and saved identities remain unchanged. This supported Bedrock touch-control component supplies a visible native use action without relying on inferred interaction labels. Definition conservation and existing eating transaction checks precede full remote CI and family saved-world validation. Actual touch initiation, rendered motion, consumption and Java parity remain unverified; no simulated players are used.

Official component contract: https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_interact_button?view=minecraft-bedrock-stable
