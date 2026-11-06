# Isolated Warmth observations

`heat_probe.js` is the unchanged observer for the G234 observation in
`heat-observed.json`. It ran on BDS 1.26.60.6 with server 2.12.0-beta,
server-ui 2.2.0 and server-gametest 1.0.0-beta. Copy the unchanged G234 scripts
into a separate diagnostic BP/RP, include G234's unchanged player definition,
and use this observer as the entry instead of `main.js`. The probe calls the
exported production effect application and tick functions with a native
SimulatedPlayer; it does not prove full main startup or ordinary client input.

The existing observer uses `captain_qa:run` and `CAPTAIN_QA_*` markers inherited
from the QA harness. Invoke that script event only on the isolated test server.
It creates a small platform and a simulated player, changes the natural
regeneration gamerule, and supplies furnace input/fuel. Never load it on LIVE.

The first attempt omitted required player properties. The configured attempt
added the unchanged G234 player definition and passed on the same QA world.
Fifteen checks confirm actual campfire on/off states, idle furnaces, furnace
ignition from real inventory contents, one-HP healing, and player disconnect.
The server then stopped normally with no content errors or OOM. The temporary
world and engine were removed; source, logs and reports were retained.

This evidence belongs to G234's heat-source behavior. It does not verify a
later remaining-duration timing change, saved-state restart, complete family
assembly, client rendering, audio or general non-player effect behavior.

## G236 duration timing and same-world restart

`timing_probe.js` is the unchanged observer for `timing-observed.json`. Use
the same isolated diagnostic setup above with the pinned G236 scripts and
unchanged player definition. Start once, invoke `captain_qa:run`, wait for
`timing-first` success and normal stop, then restart the same world and invoke
the event again for `timing-restart`. Do not reset its world clock or saved DP.

The first stage applies a 40-tick effect at native tick 87, with health 4.
Actual health at elapsed ticks 1/13/20/21/40 is 5/5/5/6/6: the first duration-40
tick and subsequent duration-20 tick heal, while a global tick-100 boundary
and expiry do not add healing. It then saves a 1213-tick production effect on
a native pig. The second stage confirms the same actor, exact effect bytes
and health 4 after normal restart. At absolute times 741 and 742, corresponding
to pre-decrement durations 601 and 600, health stays 4 then becomes 5. The
effect deadline stays unchanged. Both stages pass (10 and 11 checks), disconnect
the simulated player and stop normally without content errors or OOM.

The observer's check name mentioning a new process clock does not demonstrate
that native `system.currentTick` resets. The recorded samples show native
tick 740/741 against absolute time 741/742 after restart. This verifies the
saved deadline and duration-based checkpoint; a clock reset is injected only
in the separate main API-model test. Calling the exported effect function on
a saved pig also does not establish automatic non-player effect support.
Full main startup, client input/rendering/audio and LIVE remain outside scope.
