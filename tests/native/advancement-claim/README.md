# Isolated advancement XP and claim observation

The [2026-11-06 native observation](observed.json) passed 17 checks on BDS
1.26.60.6. It ran after the shared family deployment released its native slot.
The original observer and production functions were not modified for the run.

The observed source is `f3f32c75c7afac94557fa20e1b77e8c8da29fe7c`: PR364's
observer and unchanged G237 runtime, equal to fixed gameplay source
`f4b05f04052dfb786f7021cf15790ab605f6bf3e`. To reproduce it, use that source
on an inaccessible disposable BDS 1.26.60.6 instance. Copy its production
scripts unchanged into a diagnostic BP with a separate identity. Copy this
`probe.js` beside them and use it as the entry instead of `main.js`. Use the
existing server 2.12.0-beta and server-gametest 1.0.0-beta modules, with GameTest
and upcoming creator features enabled. Record the actual engine, module,
experiment and source inputs when running; no new player properties are needed.

On the isolated server, invoke `scriptevent grilling_qa:advancement_claim` once.
Wait for `GRILLING_QA_RESULT`, then stop normally. Retain the result, complete
log and live resource/isolation readback, and remove only this temporary QA
world after normal exit. The observer creates a small platform and one native
SimulatedPlayer, modifies only that player's XP/claim fields, and disconnects
it. Never install or invoke it on LIVE.

It directly calls the unchanged `awardOneShotAdvancement` with the real
Mountain Fragrance spec. It requires a 25-point change in native `getTotalXp`,
boolean-true completion, and refusal of a duplicate with unchanged XP. Two
other real specs receive the existing pending payload before invocation:
one without prior XP and one with its XP already applied. Both must refuse
another award, leave total XP unchanged and preserve the exact pending bytes.
The seed is diagnostic input, not an induced crash or a new recovery record.

The current API source is [Player.addExperience](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/player?view=minecraft-bedrock-stable#addexperience)
and [Player.getTotalXp](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/player?view=minecraft-bedrock-stable#gettotalxp),
checked 2026-11-06. Both calls were confirmed on the selected observed engine.

The measured native total XP changed 0→25 and the completed claim was `true`.
A duplicate award was refused with unchanged XP. Existing pending records
without prior XP and with XP already applied left totals 25→25 and 35→35,
respectively; both exact pending strings remained unchanged. All 17 checks
passed, including disconnection. The server stopped normally with exit 0,
no content errors or OOM, zero players afterward and memory peak 729550848
bytes. Its actual private-network/cgroup limits were read while BDS was alive.
MainPID was 0 and the shared lock was available before removing only this QA
world and engine; source, logs and reports were retained.

This does not prove real gameplay triggers, script/server reload, an actual
unknown write failure, cross-API atomicity, recovery of unpaid pending XP,
announcement/client rendering or family deployment. The function's current
contract and evidence limits belong to [PARITY](../../../docs/PARITY.md#進度獎勵與領取紀錄).
