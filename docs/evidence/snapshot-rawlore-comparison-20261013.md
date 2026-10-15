# RawMessage snapshot comparison repair — 2026-10-13

Status: unreleased source candidate. This is not a rendered-client or complete seasoning-flow acceptance record.

## Baseline and defect

Repository: `casama233/kaleidoscope-grilling-unofficial` (ID `1377218440`). Baseline commit: `a567e17c0316f7f2175dfef07004bb944634ca90`.

The bottle-fill path calls `retargetBottleFillStack` → `copyEatingVariant` → `restoreSkewerMetadata`. The last function checked serialized snapshot equality using `metadataSignature`, which sorted object keys but compared `rawLore` representations literally. A saved/retyped item with an equivalent RawMessage readback could therefore raise `Grilling: ingredient metadata readback differs` despite retaining its content. `ingredientContentSignature` used the same comparator.

`bottle_lore_core.js` already recognizes bounded, single-node literal/translation equivalences. This repair exports that existing comparison-only operation and reuses it for the snapshot's top-level `rawLore` field. It does not flatten mixed messages, interpret dynamic scores, rewrite persisted lore, or normalize opaque dynamic properties.

## API basis

- [Microsoft ItemStack documentation](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/itemstack?view=minecraft-bedrock-stable): string lore is returned as RawMessage text nodes; `setLore` accepts strings or RawMessage objects.
- [Microsoft RawMessage documentation](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/rawmessage?view=minecraft-bedrock-stable): `rawtext` contains message nodes; translation arguments accept either strings or a RawMessage with raw text nodes.

These contracts support the unit fixtures. They do not establish that a particular deployed server has emitted each fixture, nor prove that this defect is the sole cause of an owner's failed shake action.

## Verification actually performed

A focused Node codec suite with an ItemStack/world double ran against the pinned original modules: **23 cases, 16 passed, 7 failed**. With the two source edits: **23 cases, 23 passed, 0 failed, 0 skipped**. The seven failures cover one comparison defect class, not seven separately verified gameplay bugs. JavaScript syntax checks passed for both changed runtime modules and the test module.

Positive cases cover literal lore, singleton wrappers, literal translation arguments, restoration preserving exposed metadata, stackable metadata tokens, and native ingredient comparison. Negative cases retain failures for changed translation keys/arguments, order/count, formatting, mixed/dynamic/unknown messages, actual data loss, and changed non-lore fields. Nested custom properties named `rawLore` remain exact. The Python unittest entry runs this same Node suite; it does not count as a second independent gameplay test.

Local execution used a focused source graph, not a complete repository checkout: six full dependency modules were checked against their pinned Git blob hashes; `data.js` was represented by its unchanged `PROFILE_BY_ITEM` export, the only export needed by this test graph. The committed test defaults to the real canonical script directory. `KG_CODEC_SCRIPTS` is only an optional isolated-test override. No dependency projection is included in the runtime patch.

Run from the repository root:

```sh
node --test development/tests/runtime/snapshot_raw_lore.test.mjs
python -m unittest discover -s development/tests -p test_snapshot_raw_lore_roundtrip_20261013.py -v
```

## Unchanged scope and remaining gate

No grill state-machine, ingredients, use count, shake duration, event/session ownership, item IDs, assets, UUIDs, manifests, or deployment files were changed. The repair is not yet an exported pack release; do not install different bytes under the existing pack version. Required release identity, full-family checks, BDS/saved-world rehearsal and exact-candidate deployment remain outstanding.

Remaining game verification: carry the same self-filled bottle through take-back, full shake and seasoning application; verify early release and hotbar switching do not finish a different bottle; verify custom/localized lore and remaining uses after storage/reload. Include main/offhand and the full family pack combination. No BDS, live-world, resource rendering or human-client run occurred for this patch. Keep existing client acceptance and production-readiness flags unchanged.

## 2026-10-15: current G142 source revalidation

Reconciled the existing PR #200 with current main `014aeb89d2352a1725666a8b7dd3207cceefe2b2`, preserving its original head `d828f0a5d669d971d18b3b6e49e4ac7bc6d891b5` in history. The two runtime changes remain identical to the original narrow repair. No competing repair branch or release was created.

Ran against the complete canonical scripts, without `KG_CODEC_SCRIPTS` or a partial `data.js` stub. Added a restore-corruption control with unchanged lore, independently proving dropped dynamic properties, placement/destruction restrictions and unavailable durability still abort restoration.

- Same final 24-case suite with G142's old `metadataSignature`: 17 pass, 7 fail, 0 skipped.
- Final repaired suite: 24 pass, 0 fail, 0 skipped.
- Python unittest entry: passed; both changed runtime modules: `node --check` passed.
- `python tools/baseline_gate.py check --release`: failed as expected with `BASELINE: runtime changed without a reviewed version/hash update`.

Manifests, runtime version, baseline and release history are byte-identical to current main. This remains an unreleased draft source repair. The existing gate is retained; no package export, publication, deployment, BDS, saved-world or client acceptance is claimed. Required CI results must be checked on the updated remote commit separately.
