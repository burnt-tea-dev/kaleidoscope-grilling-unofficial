# Isolated advancement XP and claim observation

Status: prepared, **not executed**. There is no native result in this directory.
The owner of the shared native slot must schedule it after the current family
deployment. Merely loading or parsing this observer is not a passing result.

Use the fixed merged G237 source `f4b05f04052dfb786f7021cf15790ab605f6bf3e`
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
checked 2026-11-06. The running selected engine still needs to confirm them.

This does not prove real gameplay triggers, script/server reload, an actual
unknown write failure, cross-API atomicity, recovery of unpaid pending XP,
announcement/client rendering or family deployment. The function's current
contract and evidence limits belong to [PARITY](../../../docs/PARITY.md#進度獎勵與領取紀錄).
