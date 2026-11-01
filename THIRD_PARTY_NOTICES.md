# Third-party notices and license map

This repository is an unofficial Bedrock adaptation. It contains multiple independently licensed work types; there is deliberately no single root license that relicenses every file.

## Upstream projects and contributors

- **Kaleidoscope Grilling** — original Java project by **breezeth**: https://github.com/breezeth-CN/KaleidoscopeGrilling
- **Kaleidoscope Cookery** — selected reused assets and palette references by the **Kaleidoscope Official Production Team**: https://github.com/KaleidoscopeMods/KaleidoscopeCookery
- **Arbousier1/KaleidoscopeGrilling** — selected missing grill source assets preserved with the original fork notice: https://github.com/Arbousier1/KaleidoscopeGrilling
- **Senluo Bedrock Core** — shared Bedrock adapters and helpers: https://github.com/burnt-tea-dev/senluo-bedrock-core

Exact source revisions, paths, per-file hashes, conversion operations and attribution are recorded in `projects/grilling/ATTRIBUTION.md`, `source_manifest.json` files and the pinned source/compatibility records. These records are provenance evidence, not a substitute for the applicable license terms.

## License map

| Material | Applicable terms | Canonical notice |
| --- | --- | --- |
| Original Java gameplay code and code adaptations | BSD-3-Clause | `data/java/LICENSE-CODE` |
| Original Grilling artwork and adapted artwork | CC BY-NC-SA 4.0 | `data/java/LICENSE-ASSETS` |
| Reused Cookery artwork | CC BY-NC-SA 4.0, with its original copyright retained | `data/java/LICENSE-ASSETS` and `projects/grilling/ATTRIBUTION.md` |
| New offline Python tools and tests | Project-specific tool license | `projects/grilling/LICENSE-TOOLS` |
| Shared Core SDK helpers | BSD-3-Clause | https://github.com/burnt-tea-dev/senluo-bedrock-core/blob/main/LICENSE |
| Font conversions and embedded font assets | Their own font license; do not treat as Grilling artwork | `runtime/RP/font/NOTICE-Unifont.txt`, `art/fonts/README.md` and the retained Noto notice |
| Mojang/Microsoft game assets, if referenced | Original publisher terms; not relicensed here | Relevant source/provenance records |

## Redistribution rules

1. Preserve the applicable copyright notice, license text and attribution when redistributing source or binary packages.
2. CC BY-NC-SA artwork and adaptations require appropriate credit, a license link, indication of changes, noncommercial use and ShareAlike distribution.
3. Do not infer that BSD-3-Clause code licensing grants rights to artwork, sounds, fonts, third-party packs or game assets.
4. Do not infer that an upstream reference, source hash or technical compatibility grants permission to redistribute an archive that is not covered by the recorded license.
5. Before publishing a release, verify that the exact BP/RP payload carries the notices required for the content it contains. A repository-level notice alone does not prove that a downloadable package contains those notices.
6. Do not imply endorsement by the original authors, Mojang or Microsoft.

For a release-specific check, compare the exact generated BP/RP contents against the provenance manifest and the license map above. If a file's source or redistribution basis is unknown, withhold that file from the release until it is resolved.

## Release package notice gate

The canonical BP/RP source trees currently do not carry the applicable license files, even though the repository contains them. A repository-level notice does not travel with an exported pack.

Public release packaging is blocked until the next canonical BP/RP each contains:
- BP: `LICENSE-CODE` (from `data/java/LICENSE-CODE`), `LICENSE-ASSETS` (from `projects/grilling/LICENSE-ASSETS`) and this `THIRD_PARTY_NOTICES.md`.
- RP: `LICENSE-ASSETS` (from `projects/grilling/LICENSE-ASSETS`) and this `THIRD_PARTY_NOTICES.md`.

The release-only `tools/baseline_gate.py check --release` enforces these files inside each independently installable pack. Do not bypass it or raise growth ceilings. Add the files to canonical runtime, advance the pack version, run the save-compatibility and growth-ratchet checks, then use `python tools/baseline_gate.py freeze` to update the append-only runtime identity. A successful build or source hash is not client acceptance.
