# Grilling release license packaging gate

## Current result

**Release packaging is blocked until the canonical BP/RP each carry the required notices.**

The repository has source-level license and attribution files, but the canonical runtime roots currently do not include those files. A notice in the repository root or under `projects/grilling/` does not automatically travel with an exported `.mcpack` or `.mcaddon`.

The release-only check in `tools/baseline_gate.py` now fails closed if the required files are absent.

## Required runtime files

| Pack | Required file | Source of truth |
|---|---|---|
| BP | `LICENSE-CODE` | `data/java/LICENSE-CODE` |
| BP | `LICENSE-ASSETS` | `projects/grilling/LICENSE-ASSETS` |
| BP | `THIRD_PARTY_NOTICES.md` | repository root `THIRD_PARTY_NOTICES.md` |
| RP | `LICENSE-ASSETS` | `projects/grilling/LICENSE-ASSETS` |
| RP | `THIRD_PARTY_NOTICES.md` | repository root `THIRD_PARTY_NOTICES.md` |

The RP contains artwork and derived models/textures; the BP contains gameplay code and may reference original code and assets. Both independently installable packs need the applicable notices. Do not copy `LICENSE-TOOLS` into the game packs as a substitute: it licenses the offline tools, not the upstream artwork or runtime content.

## Required remediation for the next canonical version

1. Copy the exact legal notice texts into the canonical BP/RP roots listed above. Do not edit the source license terms or replace original copyright holders.
2. Ensure the third-party notice identifies breezeth, Kaleidoscope Official Production Team / YSBB, Arbousier1's separately sourced grill assets, Senluo Bedrock Core, font notices and Mojang/Microsoft publisher assets where applicable.
3. Run the ordinary static, save-compatibility and growth-ratchet checks.
4. Increment the canonical pack version; do not reuse 2.8.206 for changed runtime bytes.
5. Run `python tools/baseline_gate.py freeze` only after the complete canonical runtime and its legal files are committed for review. This updates the append-only baseline and release history; it does not certify client behavior.
6. Run `python tools/baseline_gate.py check --release`, inspect the resulting exact BP/RP export and confirm every independent package contains its required notices.
7. Only then may the package be considered for a public release, subject to the existing client and compatibility acceptance requirements.

## Important boundaries

- The code and art license grants remain separate. BSD-3-Clause does not relicense the artwork.
- CC BY-NC-SA 4.0 requires attribution, a license link, change indication, noncommercial use and ShareAlike for adapted artwork.
- Cookery and other third-party author archives are not included or relicensed by this notice.
- A successful source hash, baseline check or build is not proof of rendered client acceptance or author endorsement.
