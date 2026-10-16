package cn.breezeth.kaleidoscope_grilling.registry;

import cn.breezeth.kaleidoscope_grilling.KaleidoscopeGrilling;

import cn.breezeth.kaleidoscope_grilling.skewer.FailedSkewerData;
import cn.breezeth.kaleidoscope_grilling.oil.OilPotCompat;
import cn.breezeth.kaleidoscope_grilling.seasoning.SeasoningData;
import cn.breezeth.kaleidoscope_grilling.skewer.SkeweringHandler;
import cn.breezeth.kaleidoscope_grilling.skewer.SkewerRecipeBookItem;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.CreativeModeTab;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraftforge.fml.ModList;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.ForgeRegistries;
import net.minecraftforge.registries.RegistryObject;

public final class ModCreativeTabs {
  private static final List<String> BASE_SEASONINGS =
      List.of(
          "kaleidoscope_grilling:green_chili_powder",
          "kaleidoscope_grilling:sichuan_pepper",
          "kaleidoscope_grilling:onion_powder");

  public static final DeferredRegister<CreativeModeTab> TABS =
      DeferredRegister.create(Registries.CREATIVE_MODE_TAB, KaleidoscopeGrilling.MOD_ID);
  public static final RegistryObject<CreativeModeTab> MAIN =
      TABS.register(
          "main",
          () ->
              CreativeModeTab.builder()
                  .title(Component.translatable("itemGroup.kaleidoscope_grilling.main"))
                  .icon(() -> new ItemStack(ModBlocks.GRILL_ITEM.get()))
                  .displayItems((parameters, output) -> buildContents(output))
                  .build());

  private static void buildContents(CreativeModeTab.Output output) {
    Set<Item> added = new HashSet<>();

    // Functional equipment and prepared tool states.
    add(output, added, ModBlocks.GRILL_ITEM);
    add(output, added, ModBlocks.OIL_PRESS_ITEM);
    add(output, added, ModBlocks.BIG_VAT_ITEM);
    add(output, added, ModBlocks.ADVANCED_RACK_ITEM);
    add(output, added, beefSkewerRecipe());
    add(output, added, ModItems.EMPTY_SEASONING_BOTTLE);
    ItemStack specialSeasoning = new ItemStack(ModItems.SPECIAL_SEASONING.get());
    SeasoningData.set(specialSeasoning, BASE_SEASONINGS);
    add(output, added, specialSeasoning);
    output.accept(fullOilPot("canola"));
    output.accept(fullOilPot("secret_chili"));
    output.accept(fullOilPot("premium_chili"));
    add(output, added, ModItems.CANOLA_OIL_BUCKET);
    add(output, added, ModItems.SECRET_CHILI_OIL_BUCKET);
    add(output, added, ModItems.PREMIUM_CHILI_OIL_BUCKET);

    // All raw fixed recipes precede their cooked results.
    add(output, added, SkeweringHandler.creativePreviewSkewer());
    ModItems.RAW_SKEWERS.forEach(item -> add(output, added, item));
    ModItems.FIXED_SKEWERS.forEach(item -> add(output, added, item));
    add(output, added, customMysteriousSkewer());
    add(output, added, failedSkewer(ModItems.DARK_GRILLING.get(), 0));

    // Remaining registered content keeps a stable registration order.
    Item unfinished = ModItems.UNFINISHED_SKEWER.get();
    Item secret = ModItems.SECRET_SKEWER.get();
    Item pendingSeasoning = ModItems.PENDING_SEASONING.get();
    Item skewerPlate = ModItems.SKEWER_PLATE.get();
    Item canolaBrush = ModItems.CANOLA_OIL_BRUSH.get();
    Item secretBrush = ModItems.SECRET_CHILI_OIL_BRUSH.get();
    Item premiumBrush = ModItems.PREMIUM_CHILI_OIL_BRUSH.get();
    Item potatoBeefStew = ModItems.POTATO_BEEF_STEW.get();
    Item sourSpicyNoodles = ModItems.SOUR_SPICY_NOODLES.get();
    Item weddingCandy = ModItems.WEDDING_CANDY.get();
    boolean hasTavern = ModList.get().isLoaded("kaleidoscope_tavern");
    ModItems.ITEMS
        .getEntries()
        .forEach(
            entry -> {
              Item item = entry.get();
              if (item != unfinished
                  && item != secret
                  && item != pendingSeasoning
                  && item != skewerPlate
                  && item != canolaBrush
                  && item != secretBrush
                  && item != premiumBrush
                  && item != sourSpicyNoodles
                  && item != weddingCandy
                  && added.add(item)) {
                output.accept(item);
                if (item == potatoBeefStew && hasTavern)
                  add(output, added, new ItemStack(sourSpicyNoodles));
              }
            });
  }

  private static void add(
      CreativeModeTab.Output output, Set<Item> added, Supplier<? extends Item> item) {
    add(output, added, new ItemStack(item.get()));
  }

  private static void add(CreativeModeTab.Output output, Set<Item> added, ItemStack stack) {
    if (!stack.isEmpty() && added.add(stack.getItem())) output.accept(stack);
  }

  private static ItemStack failedSkewer(Item failedResult, int sourceIndex) {
    ItemStack stack = new ItemStack(failedResult);
    FailedSkewerData.setCreativeSource(stack, ModItems.RAW_SKEWERS.get(sourceIndex).get());
    return stack;
  }

  private static ItemStack customMysteriousSkewer() {
    ItemStack custom =
        SkeweringHandler.jeiSecretSkewer(
            List.of(
                new ItemStack(Items.APPLE),
                new ItemStack(ModItems.BEEF_CHUNKS.get()),
                new ItemStack(Items.BROWN_MUSHROOM)),
            true);
    return FailedSkewerData.create(custom, ModItems.MYSTERIOUS_SKEWER.get());
  }

  private static ItemStack fullOilPot(String type) {
    Item item =
        ForgeRegistries.ITEMS.getValue(new ResourceLocation("kaleidoscope_cookery", "oil_pot"));
    ItemStack stack = new ItemStack(item);
    OilPotCompat.fill(stack, type, 64);
    OilPotCompat.nameForDisplay(stack);
    return stack;
  }

  private static ItemStack beefSkewerRecipe() {
    ItemStack stack = new ItemStack(ModItems.SKEWER_RECIPE_BOOK.get());
    SkewerRecipeBookItem.setRecipeResult(stack, "kaleidoscope_grilling:raw_beef_skewer");
    return stack;
  }

  private ModCreativeTabs() {}
}
