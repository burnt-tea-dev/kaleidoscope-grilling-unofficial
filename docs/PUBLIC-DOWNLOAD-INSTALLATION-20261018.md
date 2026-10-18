# Published Grilling downloads: installation and safety

Audit date: 2026-10-18. This notice concerns actual public packages, not the maintained source candidate. It does not change releases, tags, assets, manifests or the stable/prerelease labels.

## Exact public packages

- Latest published TEST: [A2.8.138-beta.1](https://github.com/casama233/kaleidoscope-grilling-unofficial/releases/tag/A2.8.138-beta.1). Actual file `Kaleidoscope_Grilling_A2.8.138_Review.mcaddon`, downloaded SHA-256 `bd2d3abe0190027a0ba47de95eaef9dd88657647b0c586431863fceb5c4a5a71`; 4,399 runtime files match tag commit `d0fb23b98e3cad60340ba202effd44a05baad707`.
- Latest published stable: [A2.8.149](https://github.com/casama233/kaleidoscope-grilling-unofficial/releases/tag/A2.8.149). Actual file `Kaleidoscope_Grilling_A2.8.149_baseline1.mcaddon`, downloaded SHA-256 `9a75e2d516e3f2c222af094537bc0b0410d4132eb591231fdf5d27af39ca3bd1`; 4,501 runtime files match tag commit `aa7431f9ea729338f75f134a9c9be8194298b968`.

The TEST release is older than the stable release; it is not a recommendation to downgrade. The G138 release body inspected on the audit date mixed correct G138 binding information with a G132 staging section and G132 filenames/hashes. Use the actual G138 identity above; that staging text is not G138 installation guidance. G138's [own source scope](https://github.com/casama233/kaleidoscope-grilling-unofficial/blob/d0fb23b98e3cad60340ba202effd44a05baad707/docs/STATUS-A2.8.138.md) concerns native touch interaction declarations, with actual touch/rendered-client acceptance unverified.

## Known inventory-safety limitation

Fault-injection replay of the actual published G138 and G149 mcaddon JavaScript reproduced four outcomes: an uncertain-drop retry can leave two drops; a recipe-recording rollback after a selected-slot change can overwrite an unrelated stack; an exception after source debit can lose the source without a result; and an exception after inventory credit can trigger a second dropped result. These are production-code/API-model tests, not native Minecraft reproduction, saved-world persistence acceptance, or an estimate of everyday frequency. Test-container snapshots are not live-player observations. The published assets do not contain the later candidate repair. Back up worlds before testing; client acceptance and production readiness remain false.

已發布 G138／G149 的程式在 API 寫入後拋錯、掉落狀態不明等模型測試中，重現重複產物、來源遺失及覆寫無關欄位。這不是實際伺服器重現或發生率證明；後續候選修補尚未成為這兩個下載檔。

## Required dependency

Both releases require both BP/RP from [author Cookery **1.6.0**, CurseForge file 9054164](https://www.curseforge.com/minecraft-bedrock/addons/kaleidoscope-cookery-unofficial/files/9054164). Original archive SHA-256: `da12fe6d39d7514aff1de3c963d69899324d771be5ca0fc3da1ccb759c7ad458`. Required BP UUID: `5df753c9-3436-4fba-87f1-a2da3651cfcf`; RP UUID: `f1d333ca-2d6b-4566-8005-e6c309816324`; both version `[1,6,0]`. Cookery 1.6.1/1.6.2 have different identities and are not substitutes.

Enable both Grilling packs. The manifests declare engine 1.26.50, `@minecraft/server` 2.9.0 and `@minecraft/server-ui` 2.2.0. These declarations and matching hashes do not certify native import, gameplay or rendering.

## Public host assembly is a separate workflow

Ordinary mcaddon import does not apply `host-extensions/board-api.json`; pristine author Cookery does not provide the family board/oil/wok/locale hooks. A [public source assembler](https://github.com/casama233/kaleidoscope-tavern-unofficial/blob/3bd8f6ca285b5ef5f6e9abe962d12873dfae5752/docs/PUBLICATION-T147-G128-W124.md#公開的-cookery-api-組裝) exists without requiring private integration. The linked page is a historical T147/G128/W124 example, not a current one-command installer.

- The published T163 source lock pins T163/**G137**/W141. The newest TEST G138 does not match that source lock. Do not silently weaken its exact version/source-tree check.
- The [published T170 lock](https://github.com/casama233/kaleidoscope-tavern-unofficial/blob/3bd8f6ca285b5ef5f6e9abe962d12873dfae5752/family/upstream.lock.json) matches T170/G149/W148.
- Both locks require exact originals: Cookery1.6.0/file9054164, ChineseFood1.0.4/file8983356, ImmersiveEating1.1.0/file9104552, Nether1.0.1/file8990975 and End1.0.1/file8990981. Use their lock hashes, not whichever author download is newest.
- W141 itself requires T163 BP/RP; W148 requires T170. Grilling is not a World Liquor hard dependency. That manifest pairing does not resolve a separate source-assembler mismatch.

A completed source assembly produces its own bounded evidence. It is not automatically a successful fresh-world install, restart, rollback, client visual review or long-term stability result. No private author scripts/assets, full private integration or new public package are supplied by this documentation change.
