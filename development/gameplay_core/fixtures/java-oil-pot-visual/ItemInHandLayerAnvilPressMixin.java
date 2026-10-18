package cn.breezeth.kaleidoscope_grilling.mixin;

import cn.breezeth.kaleidoscope_grilling.oil.AnvilPressAnimation;
import cn.breezeth.kaleidoscope_grilling.oil.AnvilPressAnimationAccess;
import cn.breezeth.kaleidoscope_grilling.registry.ModItems;
import cn.breezeth.kaleidoscope_grilling.oil.OilBrushAnimation;
import cn.breezeth.kaleidoscope_grilling.oil.OilPotCompat;
import cn.breezeth.kaleidoscope_grilling.oil.OilPressTools;
import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.math.Axis;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.entity.layers.ItemInHandLayer;
import net.minecraft.client.renderer.texture.OverlayTexture;
import net.minecraft.util.Mth;
import net.minecraft.world.entity.HumanoidArm;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemDisplayContext;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(ItemInHandLayer.class)
public abstract class ItemInHandLayerAnvilPressMixin {
  private static final String RENDER_ITEM =
      "Lnet/minecraft/client/renderer/ItemInHandRenderer;renderItem(Lnet/minecraft/world/entity/LivingEntity;Lnet/minecraft/world/item/ItemStack;Lnet/minecraft/world/item/ItemDisplayContext;ZLcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/MultiBufferSource;I)V";

  @Inject(
      method = "renderArmWithItem",
      at = @At(value = "INVOKE", target = RENDER_ITEM, shift = At.Shift.BEFORE))
  private void grilling$invertSeasoningBefore(
      LivingEntity entity,
      ItemStack stack,
      ItemDisplayContext context,
      HumanoidArm arm,
      PoseStack pose,
      MultiBufferSource buffers,
      int packedLight,
      CallbackInfo ci) {
    if (!grilling$isPouring(entity, stack, arm)) return;
    pose.pushPose();
    pose.mulPose(Axis.ZP.rotationDegrees(180.0F));
  }

  @Inject(
      method = "renderArmWithItem",
      at = @At(value = "INVOKE", target = RENDER_ITEM, shift = At.Shift.AFTER))
  private void grilling$invertSeasoningAfter(
      LivingEntity entity,
      ItemStack stack,
      ItemDisplayContext context,
      HumanoidArm arm,
      PoseStack pose,
      MultiBufferSource buffers,
      int packedLight,
      CallbackInfo ci) {
    if (grilling$isPouring(entity, stack, arm)) pose.popPose();
  }

  private static boolean grilling$isPouring(LivingEntity entity, ItemStack stack, HumanoidArm arm) {
    return entity instanceof Player player
        && arm == player.getMainArm()
        && stack.is(ModItems.SPECIAL_SEASONING.get())
        && player instanceof AnvilPressAnimationAccess animation
        && animation.grilling$getSeasoningProgress(
                Minecraft.getInstance().getTimer().getGameTimeDeltaPartialTick(true))
            >= 0.0F;
  }

  @Inject(
      method = "renderArmWithItem",
      at = @At(value = "INVOKE", target = RENDER_ITEM, shift = At.Shift.BEFORE))
  private void grilling$swingOilBrushBefore(
      LivingEntity entity,
      ItemStack stack,
      ItemDisplayContext context,
      HumanoidArm arm,
      PoseStack pose,
      MultiBufferSource buffers,
      int packedLight,
      CallbackInfo ci) {
    float progress = grilling$oilBrushProgress(entity, stack, arm);
    if (progress < 0.0F) return;
    pose.pushPose();
    float side = arm == HumanoidArm.RIGHT ? 1.0F : -1.0F;
    pose.mulPose(Axis.ZP.rotationDegrees(side * OilBrushAnimation.swing(progress) * 16.0F));
  }

  @Inject(
      method = "renderArmWithItem",
      at = @At(value = "INVOKE", target = RENDER_ITEM, shift = At.Shift.AFTER))
  private void grilling$swingOilBrushAfter(
      LivingEntity entity,
      ItemStack stack,
      ItemDisplayContext context,
      HumanoidArm arm,
      PoseStack pose,
      MultiBufferSource buffers,
      int packedLight,
      CallbackInfo ci) {
    if (grilling$oilBrushProgress(entity, stack, arm) >= 0.0F) pose.popPose();
  }

  private static float grilling$oilBrushProgress(
      LivingEntity entity, ItemStack stack, HumanoidArm arm) {
    if (!(entity instanceof Player player) || !OilPotCompat.isOilPot(stack)) return -1.0F;
    AnvilPressAnimationAccess animation = (AnvilPressAnimationAccess) player;
    HumanoidArm activeArm =
        animation.grilling$getOilBrushHand() == net.minecraft.world.InteractionHand.MAIN_HAND
            ? player.getMainArm()
            : player.getMainArm().getOpposite();
    return arm == activeArm
        ? animation.grilling$getOilBrushProgress(
            Minecraft.getInstance().getTimer().getGameTimeDeltaPartialTick(true))
        : -1.0F;
  }

  @Inject(method = "renderArmWithItem", at = @At("HEAD"), cancellable = true)
  private void grilling$renderIndependentTool(
      LivingEntity entity,
      ItemStack stack,
      ItemDisplayContext context,
      HumanoidArm arm,
      PoseStack pose,
      MultiBufferSource buffers,
      int packedLight,
      CallbackInfo ci) {
    if (!(entity instanceof Player player)
        || arm != player.getMainArm()
        || OilPressTools.progress(stack) <= 0
        || !(player instanceof AnvilPressAnimationAccess animation)) return;
    float partialTick = Minecraft.getInstance().getTimer().getGameTimeDeltaPartialTick(true);
    float progress = animation.grilling$getAnvilPressProgress(partialTick);
    if (progress < 0.0F) return;

    float slam = AnvilPressAnimation.slam(progress);
    float recovery = AnvilPressAnimation.recovery(progress);
    float side = arm == HumanoidArm.RIGHT ? -1.0F : 1.0F;
    pose.pushPose();
    pose.translate(
        Mth.lerp(recovery, 0.0F, side * 0.34F),
        Mth.lerp(recovery, -0.72F + 1.18F * slam, 0.54F),
        Mth.lerp(recovery, -0.12F - 0.42F * slam, -0.12F));
    pose.mulPose(Axis.XP.rotationDegrees(Mth.lerp(recovery, 8.0F + 82.0F * slam, 0.0F)));
    pose.mulPose(Axis.YP.rotationDegrees(180.0F));
    float scale = Mth.lerp(recovery, 1.35F, 1.0F);
    pose.scale(scale, scale, scale);
    Minecraft.getInstance()
        .getItemRenderer()
        .renderStatic(
            stack,
            ItemDisplayContext.FIXED,
            packedLight,
            OverlayTexture.NO_OVERLAY,
            pose,
            buffers,
            entity.level(),
            entity.getId());
    pose.popPose();
    ci.cancel();
  }
}
