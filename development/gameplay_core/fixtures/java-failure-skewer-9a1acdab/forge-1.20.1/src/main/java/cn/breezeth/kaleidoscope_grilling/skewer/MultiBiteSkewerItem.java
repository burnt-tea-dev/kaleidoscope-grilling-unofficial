package cn.breezeth.kaleidoscope_grilling.skewer;

import cn.breezeth.kaleidoscope_grilling.data.GrillingDataManager;
import cn.breezeth.kaleidoscope_grilling.network.GrillingNetwork;
import cn.breezeth.kaleidoscope_grilling.food.HotFoodConfig;

import java.util.Map;
import java.util.WeakHashMap;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResultHolder;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.UseAnim;
import net.minecraft.world.level.Level;
import net.minecraftforge.event.entity.living.LivingEntityUseItemEvent;
import net.minecraftforge.event.entity.player.PlayerEvent;
import net.minecraftforge.event.ForgeEventFactory;
import net.minecraftforge.registries.ForgeRegistries;
import org.jetbrains.annotations.Nullable;

/** A skewer whose visible bites are completed before its food value is awarded. */
public class MultiBiteSkewerItem extends SkewerItem {
  /** Holding a skewer for this long makes an interrupted use eligible for settlement. */
  public static final int MINIMUM_EAT_TICKS = 25;
  private static final int RELEASE_CHECKPOINT_GRACE_TICKS = 1;
  private static final String ACTIVE_PROFILE_TAG = "SkewerEatingProfile";
  private static final Map<LivingEntity, ItemStack> READY_EATS = new WeakHashMap<>();
  private static final Map<LivingEntity, Boolean> SETTLED_EATS = new WeakHashMap<>();
  public enum AnimationProfile {
    ONE(90, 1.16667F, 3.08333F),
    TWO(90, 0.95833F, 4.0F),
    THREE(100, 0.95833F, 2.33333F, 3.54167F),
    THREE_ALT(90, 0.95833F, 2.16667F, 3.5F),
    THREE_RANDOM(100, 0.95833F, 2.33333F, 3.54167F),
    FOUR(90, 0.95833F, 2.33333F, 3.45833F, 4.08333F);

    private final int duration;
    private final float[] biteSeconds;

    AnimationProfile(int duration, float... biteSeconds) {
      this.duration = duration;
      this.biteSeconds = biteSeconds;
    }

    public int duration() {
      return duration;
    }
  }

  private final AnimationProfile animationProfile;

  public MultiBiteSkewerItem(
      Properties properties,
      @Nullable String tooltipKey,
      @Nullable ResourceLocation effectId,
      int effectDuration,
      AnimationProfile animationProfile) {
    super(properties, tooltipKey, effectId, effectDuration);
    this.animationProfile = animationProfile;
  }

  public AnimationProfile animationProfile() {
    return animationProfile;
  }

  public AnimationProfile animationProfile(ItemStack stack) {
    ResourceLocation itemId = ForgeRegistries.ITEMS.getKey(stack.getItem());
    var skewerData =
        itemId == null ? null : GrillingDataManager.skewerForItem(itemId.toString());
    String configured = skewerData == null ? "default" : skewerData.eatingAnimation();
    if (!configured.equals("default")
        && !configured.equals("provided")
        && !configured.equals("none")) {
      try {
        return AnimationProfile.valueOf(configured.toUpperCase(java.util.Locale.ROOT));
      } catch (IllegalArgumentException ignored) {
        // Keep the item's authored profile when script data is invalid.
      }
    }
    if (animationProfile != AnimationProfile.THREE_RANDOM || !stack.hasTag())
      return animationProfile == AnimationProfile.THREE_RANDOM ? AnimationProfile.THREE : animationProfile;
    String value = stack.getTag().getString(ACTIVE_PROFILE_TAG);
    return AnimationProfile.THREE_ALT.name().equals(value)
        ? AnimationProfile.THREE_ALT
        : AnimationProfile.THREE;
  }

  public boolean uses(AnimationProfile profile) {
    return animationProfile == profile;
  }

  public static float visualBiteStage(ItemStack stack, @Nullable LivingEntity entity) {
    if (!HotFoodConfig.ENABLE_SKEWER_EATING_ANIMATIONS.get()
        || entity == null
        || !entity.isUsingItem()
        || !ItemStack.isSameItemSameTags(stack, entity.getUseItem())
        || !(stack.getItem() instanceof MultiBiteSkewerItem animated)) return 0.0F;
    AnimationProfile profile = animated.animationProfile(stack);
    float elapsedSeconds = (profile.duration - entity.getUseItemRemainingTicks()) / 20.0F;
    int completedBites = 0;
    for (float biteSecond : profile.biteSeconds) {
      if (elapsedSeconds < biteSecond) break;
      completedBites++;
    }
    return completedBites * 0.25F;
  }

  @Override
  public int getUseDuration(ItemStack stack) {
    return HotFoodConfig.ENABLE_SKEWER_EATING_ANIMATIONS.get()
        ? animationProfile(stack).duration
        : MINIMUM_EAT_TICKS;
  }

  @Override
  public UseAnim getUseAnimation(ItemStack stack) {
    return UseAnim.EAT;
  }

  @Override
  public InteractionResultHolder<ItemStack> use(Level level, Player player, InteractionHand hand) {
    ItemStack stack = player.getItemInHand(hand);
    if (player.isShiftKeyDown()) return InteractionResultHolder.pass(stack);
    if (!level.isClientSide) {
      READY_EATS.remove(player);
      SETTLED_EATS.remove(player);
    }
    if (!HotFoodConfig.ENABLE_SKEWER_EATING_ANIMATIONS.get()) {
      clearActiveProfile(stack);
      return super.use(level, player, hand);
    }
    AnimationProfile selected =
        animationProfile == AnimationProfile.THREE_RANDOM
            ? (player.getRandom().nextBoolean() ? AnimationProfile.THREE : AnimationProfile.THREE_ALT)
            : animationProfile;

    InteractionResultHolder<ItemStack> result;
    if (stack.getCount() > 1) {
      ItemStack serving = stack.copyWithCount(1);
      setActiveProfile(serving, selected);
      if (!level.isClientSide) {
        ItemStack remainder = stack.copy();
        clearActiveProfile(remainder);
        remainder.shrink(1);
        player.setItemInHand(hand, serving);
        player.getInventory().placeItemBackInInventory(remainder);
      }
      result = super.use(level, player, hand);
    } else {
      setActiveProfile(stack, selected);
      result = super.use(level, player, hand);
    }
    if (result.getResult().consumesAction() && player instanceof ServerPlayer serverPlayer) {
      GrillingNetwork.setSkewerEatingSound(serverPlayer, selected, true);
    } else if (!result.getResult().consumesAction()) {
      clearActiveProfile(player.getItemInHand(hand));
    }
    return result;
  }

  @Override
  public void releaseUsing(ItemStack stack, Level level, LivingEntity entity, int timeLeft) {
    if (!HotFoodConfig.ENABLE_SKEWER_EATING_ANIMATIONS.get()) {
      READY_EATS.remove(entity);
      SETTLED_EATS.remove(entity);
      clearActiveProfile(stack);
      super.releaseUsing(stack, level, entity, timeLeft);
      return;
    }
    stopCustomSound(entity);
    if (!level.isClientSide && settleIfEligible(stack, level, entity, timeLeft)) {
      return;
    }
    READY_EATS.remove(entity);
    clearActiveProfile(stack);
    super.releaseUsing(stack, level, entity, timeLeft);
  }

  @Override
  public ItemStack finishUsingItem(ItemStack stack, Level level, LivingEntity entity) {
    stopCustomSound(entity);
    READY_EATS.remove(entity);
    if (!level.isClientSide && SETTLED_EATS.containsKey(entity)) return stack;
    if (!level.isClientSide) SETTLED_EATS.put(entity, Boolean.TRUE);
    ItemStack consumed = stack.copyWithCount(1);
    ItemStack result = super.finishUsingItem(stack, level, entity);
    clearActiveProfile(result);
    if (!level.isClientSide) afterFoodCommitted(consumed, level, entity);
    return result;
  }

  /** Marks the use as eligible; nutrition and effects are deferred until it actually settles. */
  public static void onUseTick(LivingEntityUseItemEvent.Tick event) {
    if (!HotFoodConfig.ENABLE_SKEWER_EATING_ANIMATIONS.get()
        || event.getEntity().level().isClientSide
        || !(event.getItem().getItem() instanceof MultiBiteSkewerItem skewer)
        || READY_EATS.containsKey(event.getEntity())) return;
    SETTLED_EATS.remove(event.getEntity());
    int usedTicks = skewer.getUseDuration(event.getItem()) - event.getDuration();
    if (usedTicks < MINIMUM_EAT_TICKS) return;
    READY_EATS.put(event.getEntity(), event.getItem());
  }

  /** Settles before lower-priority stop listeners discard their pre-use snapshots. */
  public static void onUseStop(LivingEntityUseItemEvent.Stop event) {
    if (!HotFoodConfig.ENABLE_SKEWER_EATING_ANIMATIONS.get()
        || event.getEntity().level().isClientSide) return;
    if (event.getItem().getItem() instanceof MultiBiteSkewerItem skewer) {
      skewer.stopCustomSound(event.getEntity());
      if (!skewer.settleIfEligible(
          event.getItem(),
          event.getEntity().level(),
          event.getEntity(),
          event.getDuration())) {
        READY_EATS.remove(event.getEntity());
        clearActiveProfile(event.getItem());
      }
    } else {
      READY_EATS.remove(event.getEntity());
    }
  }

  /** Logging out after the checkpoint still settles the meal exactly once. */
  public static void onPlayerLoggedOut(PlayerEvent.PlayerLoggedOutEvent event) {
    if (!HotFoodConfig.ENABLE_SKEWER_EATING_ANIMATIONS.get()) return;
    Player player = event.getEntity();
    ItemStack stack = player.isUsingItem() ? player.getUseItem() : READY_EATS.get(player);
    if (stack == null) return;
    if (stack.getItem() instanceof MultiBiteSkewerItem skewer) {
      skewer.stopCustomSound(player);
      skewer.settleIfEligible(
          stack,
          player.level(),
          player,
          player.isUsingItem() ? player.getUseItemRemainingTicks() : 0);
    } else {
      READY_EATS.remove(player);
    }
  }

  private boolean settleIfEligible(
      ItemStack stack, Level level, LivingEntity entity, int remainingTicks) {
    if (SETTLED_EATS.containsKey(entity)) return true;
    ItemStack ready = READY_EATS.get(entity);
    ItemStack timingStack = stack.isEmpty() ? ready : stack;
    if (timingStack == null || timingStack.isEmpty()) return false;
    int usedTicks = getUseDuration(timingStack) - remainingTicks;
    // The HUD uses a partial client tick. Accept the immediately adjacent server tick so
    // releasing exactly as the checkpoint turns green cannot miss settlement in transit.
    if (ready == null
        && usedTicks + RELEASE_CHECKPOINT_GRACE_TICKS < MINIMUM_EAT_TICKS) return false;
    READY_EATS.remove(entity);
    SETTLED_EATS.put(entity, Boolean.TRUE);
    if (stack.isEmpty()) stack = ready;
    ItemStack consumed = stack.copyWithCount(1);
    clearActiveProfile(stack);
    ItemStack result = finishFoodAndEffect(stack, level, entity);
    afterFoodCommitted(consumed, level, entity);
    result = ForgeEventFactory.onItemUseFinish(entity, consumed, 0, result);
    entity.setItemInHand(entity.getUsedItemHand(), result);
    return true;
  }

  private void stopCustomSound(LivingEntity entity) {
    if (entity instanceof ServerPlayer serverPlayer)
      GrillingNetwork.setSkewerEatingSound(serverPlayer, animationProfile(entity.getUseItem()), false);
  }

  protected void afterFoodCommitted(ItemStack consumed, Level level, LivingEntity entity) {}

  private static void clearActiveProfile(ItemStack stack) {
    if (stack.hasTag()) stack.getTag().remove(ACTIVE_PROFILE_TAG);
  }

  private static void setActiveProfile(ItemStack stack, AnimationProfile profile) {
    if (profile == AnimationProfile.THREE || profile == AnimationProfile.THREE_ALT)
      stack.getOrCreateTag().putString(ACTIVE_PROFILE_TAG, profile.name());
  }

}
