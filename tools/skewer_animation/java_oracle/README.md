# Pinned Java animation numerical oracle

This small harness compiles the **unchanged** `SkewerEatingAnimation.java` and
`EnderPearlEatingAnimation.java` from the existing licensed source snapshot,
upstream `breezeth-CN/KaleidoscopeGrilling@9a1acdab27698457bec16c9362678e574895a28c`.
`run.py` verifies their SHA-256 before compiling. It does not copy or rewrite them.

Run from the repository root:

```sh
python tools/skewer_animation/java_oracle/run.py --output /tmp/skewer-oracle.jsonl
python tools/skewer_animation/java_oracle/run.py --profile THREE --side LEFT --seconds 3.54167 --output /tmp/one-sample.jsonl
python tools/skewer_animation/java_oracle/run.py --math-trig --output /tmp/skewer-oracle-math.jsonl
```

No installation or network is needed when `java` includes the `jdk.compiler`
module. The runner invokes the compiler module directly, so a separate `javac`
executable is not required. It uses Java 17 language/target and the installed JDK
system modules (tested on OpenJDK 21); this is not a bundled Java 17 game runtime.
Class files are temporary and removed. JSONL and adjacent metadata are generated
outputs: do not commit them as source.

Default coverage is all five resolved profiles, both actual active-arm sides,
a 40 Hz grid, every authored named time-array key and ±10 microseconds, bite
checkpoints and clamp boundaries. The current source yields 3,730 rows.
`THREE_RANDOM` is not a sixth pose: the caller chooses THREE or THREE_ALT at use
start, with distinct durations. The harness does not execute item-use selection.

## Output

- `source_pose`: actual records returned by the unmodified Java sampling method.
- `applied_active_arm`, `applied_helper_arm`: `[x, y, z, xRot, yRot, zRot]` after
  the original apply method; position is model pixels and rotation is radians.
- `main_item_ops`, `second_item_ops`: exact ordered translate/rotation/scale API
  requests made by original transform methods. These are not computed matrices.
- `second_item_rendered`: the original first-person mixin's `scale > 0.001` rule.
- `seconds_requested`, integer `used_ticks`, and `partial_tick`: the stub player
  input passed through the source's actual elapsed-time computation.

## Evidence boundary

**This is source execution, not a Java-client/Bedrock engine oracle or screenshot.**
The game dependencies are deliberately narrow test surrogates:

- `Mth`: float degree constant, float clamp, and a 65,536-entry sine-table
  approximation matching the conventional Minecraft lookup formula. It is not
  loaded from a Minecraft jar. `--math-trig` exposes direct Java `Math` as a
  sensitivity comparison. For the current 3,730 samples, maximum applied-arm
  position difference between these surrogate modes is 0.00018 model pixels;
  sampled records and item operation sequences are identical between modes.
- `ModelPart`: six float fields, no rendering, normals or parent hierarchy.
- `PoseStack` and `Axis`: API-call recorders, not JOML/quaternions or GPU transforms.
- `Player`/`ItemStack`: duration and remaining-use-tick inputs only.
- `SkewerAnimationDebug`: disabled/pass-through, no debug time/profile override.
- `MultiBiteSkewerItem`: enum type only, not nutrition/settlement or profile logic.

The first-person mixin's outer eye-height transform, player model hand transform,
Minecraft item renderer, fixed/dynamic meshes, textures, lighting, actual
`ModelPart`/JOML internals, and camera are not executed here. Real paired client
frames are still required before claiming visual parity.
