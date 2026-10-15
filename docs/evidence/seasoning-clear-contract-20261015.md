# Wrong-ingredient bottle recovery: Java contract and source coverage

Reviewed current source: Grilling `b66f9655` (G143), compared with deployed-source reference G142 `3f63bb32890d67004352e66386d8eaf890daafea`. This is source evidence, not a claim about the installed pack or successful player crafting.

## Author behavior

[NeoForge 1.21.1 ClearSeasoningCraftingRecipe, lines20–53](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/seasoning/ClearSeasoningCraftingRecipe.java#L20-L53) accepts one pending bottle, one finished bottle, or one empty-type bottle whose ingredient list is nonempty. Any grid with at least one slot is sufficient. It returns a new empty bottle. [Forge 1.20.1](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/forge-1.20.1/src/main/java/cn/breezeth/kaleidoscope_grilling/seasoning/ClearSeasoningCraftingRecipe.java#L21-L54) agrees.

This discards all ingredients. It is not individual ingredient extraction and does not refund powder. Missing the base trio prevents an ordinary incomplete bottle from becoming pending; it does not prevent this clearing recipe. [Bottle interactions](https://github.com/breezeth-CN/KaleidoscopeGrilling/blob/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/seasoning/SeasoningBottleBlock.java#L106-L177) add ingredients, stack bottles, or pick up a whole bottle; they contain no individual ingredient-removal gesture.

## Hand and loader distinction

The primary maintained NeoForge1.21.1 block routes empty-hand interaction through `useWithoutItem` and gives the popped bottle to MAIN_HAND (`SeasoningBottleBlock.java:159–174`). Forge1.20.1 accepts an interaction hand and gives it back to that hand (`SeasoningBottleBlock.java:111–113,154–163`). Both remove a whole top bottle and neither removes individual powder. The current port also supports explicit offhand bottle transactions, a separate adaptation which must not be described as identical to both Java branches. The guide's ordinary empty-main-hand pickup instruction follows the primary NeoForge path.

## Port coverage

All83 materialized bottle IDs have83 shapeless clearing recipes: base empty/pending/special, eight partial fill IDs, eight pending fill IDs, and64 special presentation IDs. They all have exactly one item input, one fresh empty-bottle output, `crafting_table` tag, and unlock by that same input. No powder return or data-copy field exists. All83 recipe bytes are unchanged between the G142 reference and G143.

The base `empty_seasoning_bottle` clearing recipe also matches a truly empty bottle, unlike the Java dynamic-data predicate. This source-level adaptation retains recovery for legacy filled bottles that still use the base ID. It offers no extra item, but clears other item metadata as a fresh output; removing it would remove that legacy recovery route. It is not evidence that any individual powder can be refunded.

[Microsoft's shapeless recipe schema](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/recipereference/examples/recipedefinitions/recipe_shapeless?view=minecraft-bedrock-stable) documents ingredient descriptors, outputs, crafting tags, and unlock definitions. The checked one-input recipe has no shaped-grid size restriction. Actual inventory2×2 and workbench3×3 availability, unlock state, dynamic-data matching and output cleanup remain native-client checks, not inferred passes from JSON.

## Change and checks

- Guide source and generated Traditional Chinese, Simplified Chinese and English explicitly describe clearing wrong/missing-base ingredients, taking the output, and losing the entire contents without refunds.
- Extended the existing bottle-fill proxy suite to check every materialized bottle ID and its exact clearing recipe. It does not simulate crafting or claim engine acceptance.
- `python -m unittest discover -s development/gameplay_core -p test_bottle_fill_proxy_assets.py`:5 tests pass.
- `python tools/check_grilling_guide.py`: passes; source/data/serialization only.
- Earlier `node --test development/gameplay_core/test_seasoning_native_hands.mjs`:116 checks pass on unchanged bottle mechanics; these API doubles are not native crafting evidence.

No bottle mechanic or recipe was changed in this patch. No release identity, deployment or live-world change was made. Generated guide outputs still need normal release identity coordination before delivery.

## Native acceptance still needed

Use an actual bottle from the affected save, rather than a fresh give-only surrogate. Pick up the wrong-fill bottle and place it alone in a crafting slot; record its actual item ID, whether output appears, and the output's ingredient/uses data after taking it. Repeat for partial1/partial8 missing base, pending, partially used special and a legacy filled base-ID bottle; distinguish a missing recipe output from an expectation of right-click ingredient extraction. Test inventory and workbench grids, then save/reload the empty output and refill it. Preserve a backup of the original state; do not clear the player's bottle without their intended action.
