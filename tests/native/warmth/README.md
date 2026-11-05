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
