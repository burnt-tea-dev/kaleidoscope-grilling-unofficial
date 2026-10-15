package cn.breezeth.kaleidoscope_grilling.skewer;

import cn.breezeth.kaleidoscope_grilling.KaleidoscopeGrilling;
import cn.breezeth.kaleidoscope_grilling.registry.ModItems;
import java.util.List;
import net.minecraft.client.Minecraft;
import net.minecraft.client.resources.model.BakedModel;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.ItemStack;
import net.minecraftforge.registries.ForgeRegistries;

/** Resolves the detached food piece shown in the helper hand of dual-arm animations. */
public final class SkewerEatingPiece {
  public static BakedModel fixedModel(ItemStack stack, MultiBiteSkewerItem.AnimationProfile profile) {
    // Multi-ingredient animations render the last-eaten piece's dedicated 3D block model.
    if (stack.is(ModItems.SECRET_SKEWER.get())
        || stack.is(ModItems.MYSTERIOUS_SKEWER.get())
        || stack.is(ModItems.DARK_GRILLING.get())) return null;
    ResourceLocation id = ForgeRegistries.ITEMS.getKey(stack.getItem());
    if (id == null || !id.getNamespace().equals(KaleidoscopeGrilling.MOD_ID)) return null;
    String path = id.getPath();
    boolean raw = path.startsWith("raw_");
    String base = path.replaceFirst("^(raw_|grilled_)", "");
    int group = profile == MultiBiteSkewerItem.AnimationProfile.ONE ? 1 : 3;
    String suffix = raw ? "_raw" : "";
    String folder = base.endsWith("_skewer") ? base.substring(0, base.length() - 7) : base;
    ResourceLocation model =
        new ResourceLocation(
            KaleidoscopeGrilling.MOD_ID,
            "item/fixed_skewers/" + folder + "/" + base + suffix + "_piece_" + group);
    return Minecraft.getInstance().getModelManager().getModel(model);
  }

  public static ItemStack ingredient(ItemStack stack, MultiBiteSkewerItem.AnimationProfile profile) {
    List<ItemStack> ingredients = SkeweringHandler.readIngredientStacks(stack);
    if (ingredients.isEmpty()) return ItemStack.EMPTY;
    int index = profile == MultiBiteSkewerItem.AnimationProfile.ONE ? 0 : ingredients.size() - 1;
    return ingredients.get(Math.min(index, ingredients.size() - 1)).copyWithCount(1);
  }

  private SkewerEatingPiece() {}
}
