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

## Release package notices

Every independently installable BP and RP carries `LICENSE-ASSETS`, `ATTRIBUTION.md`, `LICENSE-CORE` and this notice. The BP also carries `LICENSE-CODE`. These are copies of the applicable source notices, with the original copyright retained. Pack-local filenames resolve inside each installed pack; the source/provenance paths in the table above refer to this public repository.

The Bedrock adaptation changes Java code to Bedrock Script API, converts models and UV coordinates, assembles source textures, and adds platform-specific player presentation. It remains unofficial and unfinished; the changes are not endorsed by the upstream authors. Artwork adaptations retain CC BY-NC-SA 4.0 and the code keeps its applicable BSD terms.

The release-only `tools/baseline_gate.py check --release` requires the applicable notices inside both canonical runtime packs. Adding notices changes the exported bytes, so the pack has a fresh paired version and append-only identity; existing releases are not overwritten. This packaging correction does not change gameplay code, models, textures, sound or saved identifiers. Engine and human acceptance remain separate.
