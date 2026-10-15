package cn.breezeth.kaleidoscope_grilling.skewer;

import cn.breezeth.kaleidoscope_grilling.registry.ModItems;

import net.minecraft.nbt.CompoundTag;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraftforge.registries.ForgeRegistries;

/** Preserves the source model when a skewer becomes a failed grilling result. */
public final class FailedSkewerData {
  private static final String SOURCE_TAG = "FailedSkewerSource";
  private static final String CUSTOM_SOURCE = "custom";

  private FailedSkewerData() {}

  public static ItemStack create(ItemStack input, Item failedResult) {
    ItemStack output = new ItemStack(failedResult);
    CompoundTag tag = input.hasTag() ? input.getTag().copy() : new CompoundTag();
    tag.putString(
        SOURCE_TAG,
        input.is(ModItems.SECRET_SKEWER.get())
            ? CUSTOM_SOURCE
            : ForgeRegistries.ITEMS.getKey(input.getItem()).toString());
    output.setTag(tag);
    return output;
  }

  public static void setCreativeSource(ItemStack stack, Item source) {
    CompoundTag tag = stack.hasTag() ? stack.getTag().copy() : new CompoundTag();
    tag.putString(SOURCE_TAG, ForgeRegistries.ITEMS.getKey(source).toString());
    stack.setTag(tag);
  }

  public static float modelValue(ItemStack stack) {
    String source = source(stack);
    for (int index = 0; index < ModItems.RAW_SKEWERS.size(); index++) {
      ResourceLocation id = ForgeRegistries.ITEMS.getKey(ModItems.RAW_SKEWERS.get(index).get());
      if (id.toString().equals(source)) return (index + 1) / 32.0F;
    }
    return 0.0F;
  }

  private static String source(ItemStack stack) {
    return stack.hasTag() ? stack.getTag().getString(SOURCE_TAG) : CUSTOM_SOURCE;
  }
}
