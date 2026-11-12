# 森罗物语：烟火 — 非官方 Bedrock 移植

Kaleidoscope Grilling 的 Minecraft 基岩版移植：从准备食材、穿串、刷油和调味，到烧烤、摆盘和享用料理。

[繁體中文](README.md) · **简体中文** · [English](README.en.md)

[下载 / Downloads](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/releases) · [更新记录](CHANGELOG.md)

## 功能

- 组合食材制作烤串，控制火候、翻面、用油与调料。
- 制作食用油，种植相关作物并利用加工副产物。
- 通过餐盘、料理架等器具存放和取用料理。
- 通过 Cookery 指南中的烟火入口查询分类与配方。

**重建仍在进行，尚未完整还原 Java 1.1.1。** 部分原生操作、食用效果和性能仍待修复或真人测试；详见[功能对照](docs/PARITY.md)与[已知问题](docs/KNOWN-ISSUES.md)。

## 安装

1. 备份世界，从 **Releases** 下载 `.mcaddon`；GitHub 源代码 ZIP 不是安装包。
2. 根据对应版本说明准备指定版本的 **Cookery 行为包／资源包和兼容宿主整合**，再启用烟火的 BP／RP。
3. 遵循选定版本的 Minecraft 版本及实验设置。开发主线已使用 Beta APIs，不能照搬旧版本的安装要求。

当前已记录的 G212 **完整家族**组合请参照 [Core G212 安装流程](https://github.com/burnt-tea-dev/senluo-bedrock-core/blob/main/docs/FAMILY-ASSEMBLY.md#current-g212-installation)，精确对应 T194／G212／W180、Cookery 和该组合使用的 Immersive Eating。**这不是仅玩烟火的必要组合**；[烟火公开最小安装 #342](https://github.com/burnt-tea-dev/kaleidoscope-grilling-unofficial/issues/342) 正在独立开发，目标只依赖烟火与真正必需的 Cookery，IE／TACZ／酒馆／世界名酒和私服整合均为可选。未完成实际客户端验收前，不将最小安装候选称为已发布、直接导入即可玩的正式版本。

**烟火目前还不是独立导入即可完整使用的 addon。** 直接导入 `.mcaddon` 不会给 Cookery 安装所需的宿主 API；只放入作者原始 Cookery 包同样不能完成整合。下载仅包含烟火自有内容，不包含 Cookery 或私有家族整合。四格显示还要求宿主采用自有 `player-presentation` 声明；资源包优先级不会自动合并玩家定义。参见[安装与发布](docs/RELEASING.md)和[属性迁移](docs/REBUILD-PLAN.md#t3-5-property-slimming)。

## 语言

资源文字与指南数据提供 **English、简体中文、繁體中文**。资源文字跟随 Minecraft 客户端语言，指南由 Cookery 宿主呈现。部分指南标题与包信息尚有本地化缺口，不能说所有界面都已翻译。

## 开发

需要 Python 3 和 Node.js；CI 使用 Python 3.12／Node.js 22。正式来源在 [`projects/grilling/gameplay_core`](projects/grilling/gameplay_core/)，Java 配方、时长和效果数据在 [`data/java`](data/java/)。

先阅读 [AGENTS.md](AGENTS.md) 和[重建计划](docs/REBUILD-PLAN.md) 确认任务范围，再按[测试指引](tests/README.md)选择与改动相关的现有测试。普通 PR 的常设检查由 CI 执行；完整历史回归与发布检查按需执行。

[`baseline.json`](baseline.json) 记录来源版本、精确依赖与实验要求。保留现有物品和存档身份；不要用增加物品变体、平行交互监听或逐版补丁替代共享功能修复。

## 问题反馈

请提供烟火、Cookery 和 Minecraft 版本、宿主整合方式、实验设置、复现步骤与预期结果。食用、手持及动画问题请附短视频；不要公开世界、凭据或第三方完整资源包。

## 致谢与许可

原作：[breezeth 的 KaleidoscopeGrilling](https://github.com/breezeth-CN/KaleidoscopeGrilling)，并包含 Kaleidoscope Cookery 团队素材。本项目不代表原作者或 Minecraft 官方发布。

原始代码采用 [BSD-3-Clause](data/java/LICENSE-CODE)，原始及衍生美术采用 [CC BY-NC-SA 4.0](projects/grilling/LICENSE-ASSETS)；工具另依各自许可。完整来源请参见 [ATTRIBUTION](projects/grilling/ATTRIBUTION.md) 和[第三方授权声明](THIRD_PARTY_NOTICES.md)。

发布前运行 `python3 tools/baseline_gate.py check --release`，确认配对来源与随包许可声明：BP 包含 `LICENSE-CODE`、`LICENSE-ASSETS`、`THIRD_PARTY_NOTICES.md`，RP 包含 `LICENSE-ASSETS`、`THIRD_PARTY_NOTICES.md`。完整发布步骤见[安装与发布](docs/RELEASING.md)。
