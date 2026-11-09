# Low-memory audit

Source reviewed: `1baca4ce2375b9134ed52c88f758992be6b5fd68` (2.8.254).
This records source-level work and offline evidence. It does not certify native
client memory, frame rate, engine loading, or production deployment.

## Repeated immutable item-record writes

`core/persist.js` stores stackable item metadata in immutable world records. The
record ID is derived from the serialized value, with collision resolution. The
station display restoration path reconstructs metadata through this same owner.
Previously, revisiting an identical record still called `setDynamicProperty`.

The owner now writes only a previously absent payload. Token selection, collision
resolution, the lore capacity check, existing records, and metadata values remain
unchanged. The existing item snapshot suite restores a three-property stack 100
times: the baseline makes 300 redundant world writes; the changed owner makes
zero. A changed value still makes one write, and an older snapshot remains
readable. This is an API-call count, not a measured reduction in disk I/O or RAM.

## Unused seasoning textures

The exact sixteen files `textures/a2770_placed/pending_0.png` through
`pending_15.png` are legacy, byte-identical 2048 by 704 PNGs. The current placed
seasoning entity binds `Texture.pending` to `pending_palette.png` (128 by 64),
using `pending_combined.geo.json`. The similarly named bones are not texture
paths. No literal or JSON-decoded runtime texture path refers to the old files;
the current canonical exporter copies the source packs without regenerating them.

Only those sixteen unused PNGs were removed. All active seasoning bindings,
geometry, UVs, render controllers, and palette bytes are preserved. The RP loses
16 files and 141,184 source bytes. A controlled comparison with the same ZIP
compression settings loses 32,332 archive bytes before release metadata changes.
The removed images represent 88 MiB at `width * height * 4`; this is unused source
pixel data, **not a demonstrated 88 MiB client-memory saving**. Whether the engine
loads unused textures was not measured.

## Verification

- The changed item snapshot scenario fails against the baseline (300 writes
  instead of zero) and passes with the optimization.
- The existing required gameplay smoke suite passes: 24 files, 682 tests,
  zero failures or skips.
- The unused-asset audit checked 1,188 runtime text files and compared every
  retained runtime file in controlled before/after snapshots byte for byte.
- Runtime changes receive a new paired BP/RP version and fresh baseline hashes;
  pack UUIDs, APIs, and the existing Cookery dependency stay intact.

## Remaining risks

The immutable record collection has no general reclamation mechanism. Removing
an item's token does not prove that another item, unloaded container, or saved
chunk no longer refers to that record. A synthetic sequence of 1,000 distinct
`hot_until` values leaves 1,000 world records (40,000 payload bytes in that
fixture) after removing the final item property. This is logical stored data,
not process-memory measurement. Existing world-property enumeration also grows
with the number of saved keys. The write optimization does not solve that growth.

Safe reclamation requires an explicit persistent-data lifecycle that can account
for unloaded references. A capacity cap or age-based deletion would risk making
portable items unreadable and is not part of this change.

The remaining RP still contains thousands of source textures and many display
geometries. Their source sizes alone do not show resident GPU allocations, draw
calls, or how many displays are visible together. Further visual optimization
needs reachable-resource and native profiling evidence. No resolution reduction,
entity cap, recipe removal, or timing change is introduced here.
