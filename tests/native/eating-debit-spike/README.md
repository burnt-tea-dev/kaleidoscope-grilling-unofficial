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
