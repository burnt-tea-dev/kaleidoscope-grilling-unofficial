# Two-route source integration: unversioned offline draft

This is a stacked source delta on frozen G126 head
`8d4f773dc8ef0e6b2c965f7982b0d69e283997d8`, retaining current-main parent
`d10d3b12b6cbbf922b0e940fbf174c7b24edf223` and all G126 caterpillar/HUD fixes.
No official next identity is assigned. The manifests, baseline lock, append-only
release history and G126 reviewed witnesses are unchanged. **Do not package or
ship these changed runtime bytes as G126.** Source checks are not a release receipt.

## Exact implementation

- `tools/build_two_route_eating_projection.py` derives two dedicated player clips
  from the unchanged maintained `java_eating_player.animation.json`.
- Exact cooked IDs only: `grilled_bun_slice_skewer` with TWO and
  `grilled_ender_pearl_skewer` with THREE; right/main hand, empty offhand.
- Keep the native-tested `animation.kg_isolated_two_route_v1.*` identifiers and
  `kg_isolated_two_route_player.animation.json` filename. These are private
  animation identifiers, not pack identities. Retaining them provides complete
  byte equivalence to the tested asset and avoids a gratuitous rename.
- Only the first-person selector expression changes in maintained `main.js`.
  Both target items were already admitted, so the admission expression stays
  byte-for-byte intact. The existing caterpillar selector remains the exact
  fallback. Third-person dispatch, stop conditions, controllers, imports,
  subscriptions, lifecycle, properties and settlement stay intact.
- Each dedicated clip retains the existing full blend condition and adds exact
  item/profile/hand, first-person, active use, all three property-presence checks,
  upright posture and empty-offhand guards. Unsupported contexts fall back to
  the same selector result or remain masked by the existing blend conditions.
- Only the three target arm position channels and uniform arm scale receive the
  tested outer inverse S=.9375/E=25.92. All Java rotation samples, times, clocks,
  item/socket/helper channels, attachables, geometry, render controllers and
  shared clips are unchanged. S/E remains a scoped tested mapping hypothesis,
  not independently recovered installed-engine constants.

## Evidence and acceptance boundary

Native isolated pair archive SHA256:
`a908e8bdf2821c77e5fe06a1aff9c4058e3f79383d080f5c02ea45e5edecedf8`.
Its frozen PINS SHA256:
`602b5b581d5c4cd2180d55148c6d3e4be7fd7866102a5bf4bcac5b4b2f9c1707`.
The complete shared animation and dedicated animation hashes are pinned beside
the generator input/output guards, rather than maintained in another manifest.

The separate five-film review on client 1.26.52.3, Makena/wide, FOV70, standing,
right/main, empty offhand observed improved sustained target framing, correct
full-use and short-cancel restoration, and preservation of the tested fried-egg
negative control. This transfers the exact clip bytes and bounded selector
semantics, **not native acceptance of the combined maintained-source package**.
Near-camera main enlargement and late large planar effects remain OPEN. There
is no all-food, other skin/slim/armor/FOV, left-hand, third-person, unsupported
posture, full-family, LIVE, or full Java/native visual acceptance.

## Generation and focused verification

The explicit source-preview option avoids redefining the G126 version gate:

```sh
python -B tools/build_eating_motion.py --two-route-camera
python -B tools/build_eating_motion.py --two-route-camera --check
python -B development/gameplay_core/test_two_route_eating_projection.py
```

The new augment runs after caterpillar. Its exact reversible selector wrapper
must recover the complete immutable G126 main SHA256; a partial/duplicated
wrapper or any unrelated main edit fails. It preserves the complete caterpillar
wrapper exactly once, so the existing caterpillar generator remains idempotent.
No source witness is normalized, skipped or weakened.

The focused tests cover native clip bytes, only-declared-channel changes,
exact admission and third-person preservation, duplicate/partial/out-of-scope
main rejection, two complete generated output maps, all non-target output
preservation, caterpillar bytes and each material query/property rejection.
The canonical source CI invokes this focused check before its existing strict
historical/release checks. Passing it cannot issue a canonical source receipt.

## Exact pending release integration

1. Allocate a new official identity and use the established release process to
   update paired manifests/modules, own RP dependency, payload/guide metadata,
   baseline and append-only history. Preserve the original G126 entry. In this
   draft `baseline_gate.py check` must reject changed runtime; do not freeze or
   force an alternate G126 hash.
2. After review, pin an independent immutable source commit and add a separate
   one-operation main delta: whole G126 preimage, exact selector replacement,
   whole reviewed postimage. Extend `expected_main_bytes` after G126 only for
   the allocated version. Preserve `g126-main-reviewed-delta.json` and
   `REVIEWED_CATERPILLAR_CAMERA_BASE` unchanged.
3. Add the allocated version's verifier to `verify_current.py`. Continue the
   inherited G126/HUD chain, add the new focused tests, and select the two-route
   generation augment under that version. The explicit draft flag does not
   allocate or register a version.
4. Make the current-source assertions in `test_historical_source_refs.py` and
   `test_caterpillar_eating_projection.py` use the independently reviewed new
   continuation while retaining the complete historical G125→G126 assertions.
   Update `verify_a284.py`'s exact first-person selector expectation only for
   the new version. Never replace these checks with a namespace/substring skip.
5. Add the one dedicated file's exact reviewed bytes and exact two-ID set to
   `test_secret_active_calibration.py`'s animation allowlist. Extend
   `test_native_eating_clock.py`'s named clip coverage; its existing admission
   expectation remains valid because admission has not changed.
6. Update the two clip-name assertions in `test_eating_native_completion.mjs`
   for the exact new main-hand/empty-offhand routes while preserving all
   event, settlement, helper and fallback checks. Run those affected tests.
7. Register any newly reviewed immutable refs in the historical-source
   inventory. The offline clone lacks most older audit objects; import/fetch
   those exact approved refs before a real aggregate run. This is separate
   from the intentional unversioned-runtime rejection.
8. Only after identity and source review, execute the usual exact-candidate
   canonical/full-family/saved-world gates. No source-only test substitutes for
   those checks or authorizes packaging, staging, native execution or release.

Existing broad unchanged-G126 evidence is retained. This draft does not rerun
it to inflate coverage, and does not claim the intentionally blocked release
aggregate is green.
