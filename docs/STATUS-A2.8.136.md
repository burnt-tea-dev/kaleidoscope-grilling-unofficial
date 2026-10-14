# A2.8.136 — correct full-screen eating HUD anchors

G135's full-screen packet panel retained bottom-left target and bottom-middle own anchors for fills/icons. A 51px fill projected to x=-26.5 on a 320px-wide HUD instead of the original Java x=159. Align fill/icon left edges relative to the screen bottom-middle so every fill shares the base's x=center-1 and the icon center matches the tick-25 checkpoint.

The old layout fails the new viewport regression; repaired layout and exact original-pixel/generator gates pass. Keep the G135 readable carrier and manual probes, all original textures, durations, inventory and settlement. Full CI, saved-world family admission and LIVE readback remain required. Rendered client recovery remains unverified.
