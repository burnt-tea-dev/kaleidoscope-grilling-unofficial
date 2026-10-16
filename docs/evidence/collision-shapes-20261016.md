# Grill and kitchen rack collision restoration

The exported grill used a six-pixel physical height and an eight-pixel selection
height. The author's flat and legged shapes both stop at four pixels. Both exported
boxes now use that original height.

The kitchen rack previously used a 14×9×14 box, capturing movement and aiming in
the empty space ahead of the wall shelf. Its original directional 14×9×5 shape is
restored, with the existing block rotations. Eye rays and direct-touch face recovery
now use that same facing-specific depth. Saved slot indices, display transforms,
filter/ownership metadata, transfer settlement and rendered assets stay unchanged.

Authority is [Grilling NeoForge 1.21.1 at 9a1acdab](https://github.com/breezeth-CN/KaleidoscopeGrilling/tree/9a1acdab27698457bec16c9362678e574895a28c/neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling).
`GrillBlock`, `AdvancedRackBlock` and the `ModBlocks` property registrations are bound
by their original Git blobs and complete SHA256 in the existing source contract
check and [shape witness](../../data/java-collision-shapes-20261016.json). The
collision-enabled registrations and absence of a collision override were reviewed
separately from `getShape`; mesh bounds did not define the replacement.

The targeted aim, geometry and transaction checks cover all facings, surface
boundaries, negative coordinates, input modes, nine saved cells and rejection of a
ray through the former empty front volume. The source check reads the original
`Block.box` declarations, then binds the exported shape/rotation checks to them.

Native contact and current-client control/rendering acceptance remain pending.
Source assertions and API doubles are not human play tests; `client=false`.
