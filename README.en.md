# Kaleidoscope Grilling — Unofficial Bedrock Port (森羅物語：煙火)

An unofficial Minecraft Bedrock port of Kaleidoscope Grilling: prepare ingredients, assemble skewers, oil and season them, grill, plate, and enjoy the meal.

[繁體中文](README.md) · [简体中文](README.zh-CN.md) · **English**

[Download](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/releases) · [Changelog](CHANGELOG.md)

## Features

- Assemble skewers and manage heat, turning, oil and seasonings.
- Produce cooking oils, grow relevant crops, and use processing byproducts.
- Place and collect meals using plates, preparation stands and other equipment.
- Find categories and recipes through Grilling's entry in the Cookery guide.

**Reconstruction is in progress; this is not yet complete parity with Java 1.1.1.** Some native interactions, eating visuals and performance still require fixes or hands-on validation. See the [parity report](docs/PARITY.md) and [known issues](docs/KNOWN-ISSUES.md).

## Installation

1. Back up your world and download the `.mcaddon` from **Releases**. GitHub's source ZIP is not an installation package.
2. Follow that release's instructions to obtain the specific **Cookery BP/RP and compatible host integration**, then enable Grilling's BP/RP.
3. Use the required Minecraft version and experiments. The development branch uses Beta APIs, so older installation requirements must not be copied blindly.

The currently documented G212 **full-family** installation follows [Core's exact G212 instructions](https://github.com/burnt-tea-dev/senluo-bedrock-core/blob/main/docs/FAMILY-ASSEMBLY.md#current-g212-installation), pairing T194/G212/W180 with locally adapted Cookery and optional-profile Immersive Eating. **This full-family set is not a prerequisite for playing Grilling.** [Public-minimal Issue #342](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/issues/342) tracks a separate Grilling-plus-required-Cookery workflow without IE, TACZ, Tavern, World Liquor, or private integration. Until client acceptance, its candidate is not described as a released, import-and-play package.

**Grilling currently does not work as a fully standalone, import-and-play addon.** Importing its `.mcaddon` does not install the required host APIs into Cookery, and simply adding the author's Cookery archive is not sufficient. The download contains only Grilling-owned content, not Cookery or private family integration. Four-slot presentation also requires the host's own `player-presentation` declaration; resource pack load order does not automatically combine player definitions. See [installation and release](docs/RELEASING.md) and [property migration](docs/REBUILD-PLAN.md#t3-5-property-slimming).

## Languages

Resource strings and guide data provide **English, Simplified Chinese and Traditional Chinese**. Resource strings follow the Minecraft client language; the Cookery host renders the guide. Some guide headings and pack metadata remain incompletely localized. Language-file coverage is not proof that every interface has been translated.

## Development

Requires Python 3 and Node.js. CI uses Python 3.12 and Node.js 22. Canonical code is in [`projects/grilling/gameplay_core`](projects/grilling/gameplay_core/); Java recipe, duration and effect data are in [`data/java`](data/java/).

Read [AGENTS.md](AGENTS.md) and the [rebuild plan](docs/REBUILD-PLAN.md) for the task scope, then use the [test guide](tests/README.md) to select existing tests for the affected behavior. CI runs the standard PR checks; full historical regression and release checks run when needed.

[`baseline.json`](baseline.json) records source versions, exact dependencies and experiment requirements. Preserve existing item and save identities. Do not replace shared feature repairs with extra item variants, parallel interaction listeners or version-by-version patch layers.

## Reporting issues

Include Grilling, Cookery and Minecraft versions, host integration method, experiments, reproduction steps and expected results. Attach video for eating, held-item or animation defects. Do not post private worlds, credentials or entire third-party packs.

## Credits and licenses

Original project: [KaleidoscopeGrilling by breezeth](https://github.com/breezeth-CN/KaleidoscopeGrilling), including material by the Kaleidoscope Cookery team. This is neither an official author release nor an official Minecraft release.

Original code: [BSD-3-Clause](data/java/LICENSE-CODE). Original and derivative art: [CC BY-NC-SA 4.0](projects/grilling/LICENSE-ASSETS). Tools have their respective licenses. See [ATTRIBUTION](projects/grilling/ATTRIBUTION.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for full attribution.

Before release, run `python3 tools/baseline_gate.py check --release` to validate the paired source and packaged license notices: BP must contain `LICENSE-CODE`, `LICENSE-ASSETS`, and `THIRD_PARTY_NOTICES.md`; RP must contain `LICENSE-ASSETS` and `THIRD_PARTY_NOTICES.md`. See [installation and release](docs/RELEASING.md) for the complete release procedure.
