# PR213 regression preservation on merged G143

This tests-only continuation starts at merged G143 `b66f9655ccdedbb78f0fa306973501299f3578a7`.
The source witness is [PR213](https://github.com/casama233/kaleidoscope-grilling-unofficial/pull/213), head `fd1e65657b9b7093bbc190f2201673f258e496bc`.

G143 independently implements the offhand clock and owning-player property scope.
It did not carry every regression from PR213. This change preserves those checks,
without importing PR213 runtime generators, its historical adapter or old evidence claims.

- `test_offhand_eating_clock.py` reads every actual exported `.left` player clip.
  It checks both 90/100-tick durations, independent main-hand counters, elapsed
  boundaries and immediate cancellation. The evaluator additionally understands
  the current owning-entity expression syntax; it does not replace runtime values.
- The production native-use harness gains PR213's unchanged main/offhand
  cancel/replacement/restart cases and alternating-hand stale-cleanup case.
- `verify_a28143.py` explicitly runs the exported-clip regression in required
  source CI. The existing verifier chain already runs the production harness.

Focused local validation on this exact source: exported-clock regression 1 pass;
existing owner-context regression 3 pass; full production harness 302 pass,
0 failures and 0 skips. Required PR CI must independently validate the final Git
commit. No full-suite local success is claimed.

No runtime, assets, pack versions, UUIDs, saved-world or deployment changes.
API-double and Molang evaluation tests do not establish Minecraft client acceptance;
`client=false`, `production_ready=false`. PR213 stays open pending preservation review.
