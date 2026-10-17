package cn.breezeth.kaleidoscope_grilling.oil;

import cn.breezeth.kaleidoscope_grilling.registry.ModItems;

import net.minecraft.util.Mth;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;

public final class OilBrushAnimation {
  public static final byte FIRST_EVENT_ID = 70;
  public static final int DURATION_TICKS = 20;

  public static void start(Player player, InteractionHand hand, String oilType) {
    int type = type(oilType);
    ((AnvilPressAnimationAccess) player).grilling$startOilBrush(hand, type);
    player.level().broadcastEntityEvent(player, eventId(hand, type));
  }

  public static boolean isEvent(byte id) {
    return id >= FIRST_EVENT_ID && id < FIRST_EVENT_ID + 6;
  }

  public static InteractionHand hand(byte id) {
    return ((id - FIRST_EVENT_ID) & 1) == 0 ? InteractionHand.MAIN_HAND : InteractionHand.OFF_HAND;
  }

  public static int type(byte id) {
    return (id - FIRST_EVENT_ID) / 2;
  }

  public static float swing(float progress) {
    return Mth.sin(Mth.clamp(progress, 0.0F, 1.0F) * Mth.TWO_PI);
  }

  public static ItemStack stack(int type) {
    return new ItemStack(
        type == 1
            ? ModItems.SECRET_CHILI_OIL_BRUSH.get()
            : type == 2 ? ModItems.PREMIUM_CHILI_OIL_BRUSH.get() : ModItems.CANOLA_OIL_BRUSH.get());
  }

  private static byte eventId(InteractionHand hand, int type) {
    return (byte) (FIRST_EVENT_ID + type * 2 + (hand == InteractionHand.OFF_HAND ? 1 : 0));
  }

  private static int type(String oilType) {
    return "secret_chili".equals(oilType) ? 1 : "premium_chili".equals(oilType) ? 2 : 0;
  }

  private OilBrushAnimation() {}
}
