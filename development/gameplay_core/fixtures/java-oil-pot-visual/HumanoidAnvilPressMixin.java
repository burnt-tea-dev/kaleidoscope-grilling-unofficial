package cn.breezeth.kaleidoscope_grilling.mixin;

import cn.breezeth.kaleidoscope_grilling.oil.AnvilPressAnimation;
import cn.breezeth.kaleidoscope_grilling.oil.AnvilPressAnimationAccess;
import cn.breezeth.kaleidoscope_grilling.registry.ModEffects;
import cn.breezeth.kaleidoscope_grilling.registry.ModItems;
import cn.breezeth.kaleidoscope_grilling.oil.OilBrushAnimation;
import cn.breezeth.kaleidoscope_grilling.seasoning.SeasoningAnimation;
import net.minecraft.client.model.HumanoidModel;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.util.Mth;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.entity.HumanoidArm;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(HumanoidModel.class)
public abstract class HumanoidAnvilPressMixin<T extends LivingEntity> {
  @Shadow public ModelPart leftArm;
  @Shadow public ModelPart rightArm;
  @Shadow public ModelPart leftLeg;
  @Shadow public ModelPart rightLeg;

  @Inject(method = "setupAnim(Lnet/minecraft/world/entity/LivingEntity;FFFFF)V", at = @At("TAIL"))
  private void grilling$pose(
      T entity,
      float walkPosition,
      float walkSpeed,
      float age,
      float yaw,
      float pitch,
      CallbackInfo ci) {
    if (!(entity instanceof Player player)
        || !(entity instanceof AnvilPressAnimationAccess animation)) return;
    float partial = Mth.clamp(age - entity.tickCount, 0.0F, 1.0F);
    float press = animation.grilling$getAnvilPressProgress(partial);
    if (press >= 0.0F) {
      float slam = AnvilPressAnimation.slam(press), recovery = AnvilPressAnimation.recovery(press);
      float target = Mth.lerp(recovery, Mth.lerp(slam, -2.85F, -0.72F), rightArm.xRot);
      rightArm.xRot = leftArm.xRot = target;
      rightArm.yRot = -0.16F;
      leftArm.yRot = 0.16F;
      rightArm.zRot = 0.08F;
      leftArm.zRot = -0.08F;
      return;
    }
    float brushing = animation.grilling$getOilBrushProgress(partial);
    if (brushing >= 0.0F) {
      HumanoidArm brushArm =
          animation.grilling$getOilBrushHand() == InteractionHand.MAIN_HAND
              ? player.getMainArm()
              : player.getMainArm().getOpposite();
      ModelPart brushArmPart = brushArm == HumanoidArm.RIGHT ? rightArm : leftArm;
      float brushSide = brushArm == HumanoidArm.RIGHT ? 1.0F : -1.0F;
      float brushSwing = OilBrushAnimation.swing(brushing);
      brushArmPart.xRot = -1.32F;
      brushArmPart.yRot = brushSide * 0.18F + brushSwing * 0.70F;
      brushArmPart.zRot = brushSide * (0.10F + brushSwing * 0.42F);
      return;
    }
    ModelPart arm = player.getMainArm() == HumanoidArm.RIGHT ? rightArm : leftArm;
    float side = player.getMainArm() == HumanoidArm.RIGHT ? 1.0F : -1.0F;
    if (player.isUsingItem()
        && player.getUsedItemHand() == InteractionHand.MAIN_HAND
        && player.getUseItem().is(ModItems.PENDING_SEASONING.get())) {
      float wave = Mth.sin(age * 1.7F);
      float crossWave = Mth.cos(age * 1.7F);
      arm.xRot = -1.35F + wave * 0.35F;
      arm.yRot = side * (0.30F + wave * 0.65F);
      arm.zRot = side * (0.45F + crossWave * 0.55F);
      return;
    }
    float seasoning = animation.grilling$getSeasoningProgress(partial);
    if (seasoning >= 0.0F) {
      float arc = SeasoningAnimation.arc(seasoning);
      float wave = Mth.sin(seasoning * Mth.TWO_PI * 2.0F);
      arm.xRot = -1.75F - 0.35F * arc + 0.18F * wave;
      arm.yRot = side * (0.35F + 0.95F * wave);
      arm.zRot = side * (0.55F + 0.55F * arc + 0.25F * wave);
      return;
    }
    if (!player.hasEffect(ModEffects.NUMB)) return;
    float movement = Mth.clamp(walkSpeed * 1.8F, 0.0F, 1.0F);
    if (movement < 0.04F) return;
    float phase = age * 0.32F;
    float armWave = Mth.cos(phase);
    float armCrossWave = Mth.sin(phase);
    float legWave = Mth.cos(phase);
    rightArm.xRot = armWave * 3.1F * movement;
    leftArm.xRot = -armWave * 3.1F * movement;
    rightArm.zRot = armCrossWave * 0.75F * movement;
    leftArm.zRot = -armCrossWave * 0.75F * movement;
    rightLeg.xRot = -legWave * 1.65F * movement;
    leftLeg.xRot = legWave * 1.65F * movement;
    rightLeg.zRot = 0.0F;
    leftLeg.zRot = 0.0F;
  }
}
