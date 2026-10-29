# Native early-debit capability probe

This isolated test answers the prerequisite in REBUILD-PLAN T3.4: when a
100-tick native meal is debited by script at tick25 or90, does native use stop,
or can completion consume a second serving? A native completion control and a
last-serving case distinguish missing simulator events from a safe debit.

Install only this diagnostic BP on an isolated BDS1.26.60 test world with Beta
APIs enabled. Never install it on LIVE or include it in a formal export. It
creates four simulated players and test meals, observes135 ticks, and
disconnects all four. Retain the full content log. A successful probe execution
is not a successful early debit: read nativeControl, eventControl and debitSafe
separately. Unavailable item events cannot prove cancellation.

The current native duration/shadow route stays intact until the required
capability and actual player behavior are established. This probe does not
render animation, certify opaque metadata or justify identifier retirement.

References: [SimulatedPlayer](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-gametest/simulatedplayer?view=minecraft-bedrock-experimental)
and [standalone spawn](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-gametest/minecraft-server-gametest?view=minecraft-bedrock-experimental#spawnsimulatedplayer).

`logout_probe.js` is a separate event-order experiment. In an isolated copy of
this BP, select `scripts/logout_probe.js` as the script entry. It compares a
native completion and an explicit stop with direct simulated disconnects at
23/25/26/90 ticks. Read `stopBeforeLeave` and the actual remaining counters;
`ok` only establishes the controls and observation completed. It never writes
from before-leave or claims to test Grilling settlement, a real network loss,
client rendering, or logout persistence.

The disconnect observer also attempts an unchanged-stack write in before-leave
and reads the player in `system.run`. On BDS1.26.60.6 these respectively return
restricted-execution and invalid-entity errors. These are expected capability
observations, not successful settlement. The [before-leave API contract](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/playerleavebeforeeventsignal?view=minecraft-bedrock-experimental)
also describes the restricted callback. The recorded error strings come from
this isolated engine; they do not establish a platform-wide impossibility.
