package cn.breezeth.kaleidoscope_grilling.oil;

import cn.breezeth.kaleidoscope_grilling.KaleidoscopeGrilling;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.math.Axis;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.texture.OverlayTexture;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.entity.HumanoidArm;
import net.minecraft.world.item.ItemDisplayContext;
import net.neoforged.api.distmarker.Dist;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.client.event.RenderHandEvent;

@EventBusSubscriber(modid = KaleidoscopeGrilling.MOD_ID, value = Dist.CLIENT)
public final class OilBrushFirstPersonAnimation {
  @SubscribeEvent
  public static void render(RenderHandEvent event) {
    Minecraft minecraft = Minecraft.getInstance();
    var player = minecraft.player;
    if (player == null) return;
    AnvilPressAnimationAccess animation = (AnvilPressAnimationAccess) player;
    float progress = animation.grilling$getOilBrushProgress(event.getPartialTick());
    if (progress < 0.0F || event.getHand() != animation.grilling$getOilBrushHand()) return;
    event.setCanceled(true);

    HumanoidArm arm =
        event.getHand() == InteractionHand.MAIN_HAND
            ? player.getMainArm()
            : player.getMainArm().getOpposite();
    float side = arm == HumanoidArm.RIGHT ? 1.0F : -1.0F;
    float swing = OilBrushAnimation.swing(progress);
    PoseStack pose = event.getPoseStack();
    pose.pushPose();
    pose.translate(side * 0.52F + swing * 0.25F, -0.48F, -0.78F);
    pose.mulPose(Axis.XP.rotationDegrees(-24.0F));
    pose.mulPose(Axis.YP.rotationDegrees(180.0F));
    pose.mulPose(Axis.ZP.rotationDegrees(side * (32.0F + swing * 34.0F)));
    ItemDisplayContext context =
        arm == HumanoidArm.RIGHT
            ? ItemDisplayContext.FIRST_PERSON_RIGHT_HAND
            : ItemDisplayContext.FIRST_PERSON_LEFT_HAND;
    minecraft
        .getItemRenderer()
        .renderStatic(
            OilBrushAnimation.stack(animation.grilling$getOilBrushType()),
            context,
            event.getPackedLight(),
            OverlayTexture.NO_OVERLAY,
            pose,
            event.getMultiBufferSource(),
            minecraft.level,
            player.getId());
    pose.popPose();
  }

  private OilBrushFirstPersonAnimation() {}
}
