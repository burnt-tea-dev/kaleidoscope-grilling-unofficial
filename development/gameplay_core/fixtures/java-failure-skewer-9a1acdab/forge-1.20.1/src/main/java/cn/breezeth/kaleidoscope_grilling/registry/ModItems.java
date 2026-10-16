package cn.breezeth.kaleidoscope_grilling.registry;

import cn.breezeth.kaleidoscope_grilling.KaleidoscopeGrilling;

import cn.breezeth.kaleidoscope_grilling.skewer.CursedSkewerItem;
import cn.breezeth.kaleidoscope_grilling.food.DescriptionItem;
import cn.breezeth.kaleidoscope_grilling.food.DualEffectFoodItem;
import cn.breezeth.kaleidoscope_grilling.food.EffectFoodItem;
import cn.breezeth.kaleidoscope_grilling.food.FlavorFoodItem;
import cn.breezeth.kaleidoscope_grilling.skewer.GoldenSkewerItem;
import cn.breezeth.kaleidoscope_grilling.skewer.MultiBiteSkewerItem;
import cn.breezeth.kaleidoscope_grilling.oil.OilResidueItem;
import cn.breezeth.kaleidoscope_grilling.seasoning.PendingSeasoningItem;
import cn.breezeth.kaleidoscope_grilling.food.RawSweetPotatoSheetItem;
import cn.breezeth.kaleidoscope_grilling.seasoning.SeasoningBottleBlockItem;
import cn.breezeth.kaleidoscope_grilling.seasoning.SeasoningItem;
import cn.breezeth.kaleidoscope_grilling.skewer.SecretSkewerItem;
import cn.breezeth.kaleidoscope_grilling.skewer.SkewerItem;
import cn.breezeth.kaleidoscope_grilling.skewer.SkewerPlateItem;
import cn.breezeth.kaleidoscope_grilling.skewer.SkewerRecipeBookItem;
import cn.breezeth.kaleidoscope_grilling.food.SweetPotatoPowderItem;
import cn.breezeth.kaleidoscope_grilling.food.WeddingCandyItem;
import cn.breezeth.kaleidoscope_grilling.skewer.UnfinishedSkewerItem;


import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.food.FoodProperties;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemNameBlockItem;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.ForgeRegistries;
import net.minecraftforge.registries.RegistryObject;

public final class ModItems {
  public static final DeferredRegister<Item> ITEMS =
      DeferredRegister.create(ForgeRegistries.ITEMS, KaleidoscopeGrilling.MOD_ID);
  public static final List<RegistryObject<Item>> FIXED_SKEWERS = new ArrayList<>();
  public static final List<RegistryObject<Item>> RAW_SKEWERS = new ArrayList<>();
  public static final List<RegistryObject<Item>> INGREDIENTS = new ArrayList<>();
  public static final RegistryObject<Item> UNFINISHED_SKEWER =
      ITEMS.register("unfinished_skewer", () -> new UnfinishedSkewerItem(new Item.Properties()));
  public static final RegistryObject<Item> SKEWER_RECIPE_BOOK =
      ITEMS.register(
          "skewer_recipe_book", () -> new SkewerRecipeBookItem(new Item.Properties().stacksTo(1)));
  public static final RegistryObject<Item> SECRET_SKEWER =
      ITEMS.register(
          "secret_skewer",
          () ->
              new SecretSkewerItem(
                  new Item.Properties()
                      .stacksTo(64)
                      .food(new FoodProperties.Builder().nutrition(1).saturationMod(0).build())));
  public static final RegistryObject<Item> SKEWER_PLATE =
      ITEMS.register(
          "skewer_plate",
          () ->
              new SkewerPlateItem(
                  new Item.Properties()
                      .stacksTo(1)
                      .food(new FoodProperties.Builder().nutrition(1).saturationMod(0).build())));
  public static final RegistryObject<Item> CANOLA_OIL_BRUSH =
      ITEMS.register(
          "canola_oil_brush",
          () ->
              new DescriptionItem(
                  new Item.Properties().stacksTo(1),
                  "tooltip.kaleidoscope_grilling.oil_brush.unobtainable"));
  public static final RegistryObject<Item> SECRET_CHILI_OIL_BRUSH =
      ITEMS.register(
          "secret_chili_oil_brush",
          () ->
              new DescriptionItem(
                  new Item.Properties().stacksTo(1),
                  "tooltip.kaleidoscope_grilling.oil_brush.unobtainable"));
  public static final RegistryObject<Item> PREMIUM_CHILI_OIL_BRUSH =
      ITEMS.register(
          "premium_chili_oil_brush",
          () ->
              new DescriptionItem(
                  new Item.Properties().stacksTo(1),
                  "tooltip.kaleidoscope_grilling.oil_brush.unobtainable"));

  public static final RegistryObject<Item> BEEF_CHUNKS = ingredient("beef_chunks");
  public static final RegistryObject<Item> CHICKEN_SKIN = ingredient("chicken_skin");
  public static final RegistryObject<Item> CHICKEN_WING =
      ingredient(
          "chicken_wing",
          () ->
              new Item(
                  new Item.Properties()
                      .food(
                          new FoodProperties.Builder().nutrition(2).saturationMod(0.06F).build())));
  public static final RegistryObject<Item> SQUID_TENTACLE = ingredient("squid_tentacle");
  public static final RegistryObject<Item> HOUTTUYNIA =
      ingredient(
          "houttuynia",
          () ->
              new ItemNameBlockItem(
                  ModBlocks.HOUTTUYNIA_CROP.get(),
                  new Item.Properties()
                      .food(
                          new FoodProperties.Builder().nutrition(2).saturationMod(0.2F).build())));
  public static final RegistryObject<Item> MINCED_HOUTTUYNIA = ingredient("minced_houttuynia");
  public static final RegistryObject<Item> CARROT_DICE = ingredient("carrot_dice");
  public static final RegistryObject<Item> RAW_SWEET_POTATO_SHEET =
      ingredient(
          "raw_sweet_potato_sheet", () -> new RawSweetPotatoSheetItem(new Item.Properties()));
  public static final RegistryObject<Item> POTATO_SLICE = ingredient("potato_slice");
  public static final RegistryObject<Item> RAW_MANTOU_SLICE = ingredient("raw_mantou_slice");
  public static final RegistryObject<Item> MYSTERIOUS_SKEWER =
      ITEMS.register(
          "mysterious_skewer",
          () ->
              new MultiBiteSkewerItem(
                  new Item.Properties()
                      .food(new FoodProperties.Builder().nutrition(2).saturationMod(0.0F).build()),
                  "tooltip.kaleidoscope_grilling.mysterious_skewer.maxim",
                  new ResourceLocation("minecraft", "nausea"),
                  100,
                  MultiBiteSkewerItem.AnimationProfile.THREE_RANDOM));
  public static final RegistryObject<Item> DARK_GRILLING =
      ITEMS.register(
          "dark_grilling",
          () ->
              new MultiBiteSkewerItem(
                  new Item.Properties()
                      .food(new FoodProperties.Builder().nutrition(1).saturationMod(0.0F).build()),
                  "tooltip.kaleidoscope_grilling.dark_grilling.maxim",
                  new ResourceLocation("minecraft", "blindness"),
                  200,
                  MultiBiteSkewerItem.AnimationProfile.THREE_RANDOM));
  public static final RegistryObject<Item> EMPTY_SEASONING_BOTTLE =
      ITEMS.register(
          "empty_seasoning_bottle",
          () ->
              new SeasoningBottleBlockItem(
                  ModBlocks.SEASONING_BOTTLE.get(), new Item.Properties().stacksTo(1)));
  public static final RegistryObject<Item> PENDING_SEASONING =
      ITEMS.register(
          "pending_seasoning",
          () ->
              new PendingSeasoningItem(
                  ModBlocks.SEASONING_BOTTLE.get(), new Item.Properties().stacksTo(1)));
  public static final RegistryObject<Item> SPECIAL_SEASONING =
      ITEMS.register(
          "special_seasoning",
          () ->
              new SeasoningItem(
                  ModBlocks.SEASONING_BOTTLE.get(),
                  new Item.Properties().stacksTo(1)));
  public static final RegistryObject<Item> GREEN_CHILI_POWDER = ingredient("green_chili_powder");
  public static final RegistryObject<Item> SICHUAN_PEPPER =
      ingredient(
          "sichuan_pepper",
          () ->
              new EffectFoodItem(
                  new Item.Properties()
                      .food(new FoodProperties.Builder().nutrition(1).saturationMod(0.25F).build()),
                  grillingEffect("numb"),
                  200,
                  "tooltip.kaleidoscope_grilling.sichuan_pepper"));
  public static final RegistryObject<Item> ONION_POWDER = ingredient("onion_powder");
  public static final RegistryObject<Item> HOUTTUYNIA_POWDER = ingredient("houttuynia_powder");
  public static final RegistryObject<Item> TOTEM_POWDER = ingredient("totem_powder");
  public static final RegistryObject<Item> DRAGON_EGG_POWDER = ingredient("dragon_egg_powder");
  public static final RegistryObject<Item> OIL_CAKE = ingredient("oil_cake");
  public static final RegistryObject<Item> OIL_RESIDUE =
      ingredient("oil_residue", () -> new OilResidueItem(new Item.Properties()));
  public static final RegistryObject<Item> CANOLA_POWDER = ingredient("canola_powder");
  public static final RegistryObject<Item> RED_CHILI_POWDER = ingredient("red_chili_powder");
  public static final RegistryObject<Item> ONION =
      ingredient(
          "onion", () -> new ItemNameBlockItem(ModBlocks.ONION_CROP.get(), new Item.Properties()));
  public static final RegistryObject<Item> SWEET_POTATO =
      ITEMS.register(
          "sweet_potato",
          () ->
              new ItemNameBlockItem(
                  ModBlocks.SWEET_POTATO_CROP.get(),
                  new Item.Properties()
                      .food(
                          new FoodProperties.Builder().nutrition(3).saturationMod(0.1F).build())));
  public static final RegistryObject<Item> ROASTED_SWEET_POTATO =
      ITEMS.register(
          "roasted_sweet_potato",
          () ->
              new EffectFoodItem(
                  new Item.Properties()
                      .food(new FoodProperties.Builder().nutrition(6).saturationMod(0.2F).build()),
                  cookeryEffect("warmth"),
                  600,
                  "tooltip.kaleidoscope_grilling.roasted_sweet_potato.maxim"));
  public static final RegistryObject<Item> SWEET_POTATO_POWDER =
      ITEMS.register("sweet_potato_powder", () -> new SweetPotatoPowderItem(new Item.Properties()));
  public static final RegistryObject<Item> ROASTED_CHICKEN_WING =
      ITEMS.register(
          "roasted_chicken_wing",
          () ->
              new FlavorFoodItem(
                  new Item.Properties()
                      .food(new FoodProperties.Builder().nutrition(5).saturationMod(0.12F).build()),
                  "tooltip.kaleidoscope_grilling.roasted_chicken_wing.maxim"));
  public static final RegistryObject<Item> COLD_HOUTTUYNIA =
      ITEMS.register(
          "cold_houttuynia",
          () ->
              new EffectFoodItem(
                  new Item.Properties()
                      .food(new FoodProperties.Builder().nutrition(6).saturationMod(1.0F).build()),
                  new ResourceLocation("minecraft", "fire_resistance"),
                  1200,
                  "tooltip.kaleidoscope_grilling.cold_houttuynia.maxim"));
  public static final RegistryObject<Item> SUGARED_TOMATO =
      ITEMS.register(
          "sugared_tomato",
          () ->
              new FlavorFoodItem(
                  new Item.Properties()
                      .food(new FoodProperties.Builder().nutrition(6).saturationMod(0.65F).build()),
                  "tooltip.kaleidoscope_grilling.sugared_tomato.maxim"));
  public static final RegistryObject<Item> PEPPER_HONEY =
      ITEMS.register(
          "pepper_honey",
          () ->
              new EffectFoodItem(
                  new Item.Properties()
                      .food(new FoodProperties.Builder().nutrition(4).saturationMod(0.25F).build()),
                  grillingEffect("numb"),
                  1200,
                  "tooltip.kaleidoscope_grilling.pepper_honey.maxim"));
  public static final RegistryObject<Item> WEDDING_CANDY =
      ITEMS.register(
          "wedding_candy",
          () ->
              new WeddingCandyItem(
                  new Item.Properties()
                      .food(
                          new FoodProperties.Builder()
                              .nutrition(20)
                              .saturationMod(0.5F)
                              .alwaysEat()
                              .build()),
                  grillingEffect("invincible")));
  public static final RegistryObject<Item> HOUTTUYNIA_STIR_FRIED_PORK =
      dish("houttuynia_stir_fried_pork", 9, 0.7F);
  public static final RegistryObject<Item> GREEN_PEPPER_SQUID_TENTACLES =
      dish("green_pepper_squid_tentacles", 8, 0.6F);
  public static final RegistryObject<Item> BRAISED_CHICKEN_WINGS =
      dish("braised_chicken_wings", 10, 0.8F);
  public static final RegistryObject<Item> POTATO_BEEF_STEW = dish("potato_beef_stew", 12, 0.9F);
  public static final RegistryObject<Item> RED_SWEET_POTATO_PORRIDGE =
      ITEMS.register(
          "red_sweet_potato_porridge",
          () ->
              new DualEffectFoodItem(
                  new Item.Properties()
                      .stacksTo(16)
                      .food(
                          new FoodProperties.Builder()
                              .nutrition(14)
                              .saturationMod(0.071429F)
                              .build()),
                  cookeryEffect("flatulence"),
                  900,
                  cookeryEffect("warmth"),
                  900,
                  "tooltip.kaleidoscope_grilling.red_sweet_potato_porridge.maxim"));
  public static final RegistryObject<Item> CANOLA_SEEDS =
      ITEMS.register(
          "canola_seeds",
          () -> new ItemNameBlockItem(ModBlocks.CANOLA_CROP.get(), new Item.Properties()));
  public static final RegistryObject<Item> CANOLA_OIL_BUCKET =
      ITEMS.register(
          "canola_oil_bucket",
          () ->
              new net.minecraft.world.item.BucketItem(
                  ModFluids.CANOLA_SOURCE, new Item.Properties().stacksTo(1)));
  public static final RegistryObject<Item> SECRET_CHILI_OIL_BUCKET =
      ITEMS.register(
          "secret_chili_oil_bucket",
          () ->
              new net.minecraft.world.item.BucketItem(
                  ModFluids.SECRET_SOURCE, new Item.Properties().stacksTo(1)));
  public static final RegistryObject<Item> PREMIUM_CHILI_OIL_BUCKET =
      ITEMS.register(
          "premium_chili_oil_bucket",
          () ->
              new net.minecraft.world.item.BucketItem(
                  ModFluids.PREMIUM_SOURCE,
                  new Item.Properties()
                      .stacksTo(1)
                      .craftRemainder(net.minecraft.world.item.Items.BUCKET)));
  public static final RegistryObject<Item> RAW_LAMB_SKEWER =
      ITEMS.register(
          "raw_lamb_skewer",
          () ->
              new MultiBiteSkewerItem(
                  new Item.Properties()
                      .food(new FoodProperties.Builder().nutrition(4).saturationMod(0.8F).build()),
                  null,
                  null,
                  0,
                  MultiBiteSkewerItem.AnimationProfile.THREE_RANDOM));
  public static final RegistryObject<Item> GRILLED_LAMB_SKEWER =
      ITEMS.register(
          "grilled_lamb_skewer",
          () ->
              new MultiBiteSkewerItem(
                  new Item.Properties()
                      .food(new FoodProperties.Builder().nutrition(8).saturationMod(0.8F).build()),
                  "tooltip.kaleidoscope_grilling.grilled_lamb_skewer.maxim",
                  cookeryEffect("warmth"),
                  45 * 20,
                  MultiBiteSkewerItem.AnimationProfile.THREE_RANDOM));
  public static final RegistryObject<Item> RAW_GOLDEN_SKEWER =
      ITEMS.register(
          "raw_golden_skewer",
          () ->
              new MultiBiteSkewerItem(
                  new Item.Properties()
                      .food(new FoodProperties.Builder().nutrition(6).saturationMod(1.2F).build()),
                  null,
                  null,
                  0,
                  MultiBiteSkewerItem.AnimationProfile.THREE_RANDOM));
  public static final RegistryObject<Item> GRILLED_GOLDEN_SKEWER =
      ITEMS.register(
          "grilled_golden_skewer",
          () ->
              new GoldenSkewerItem(
                  new Item.Properties()
                      .food(new FoodProperties.Builder().nutrition(12).saturationMod(1.2F).build())));
  public static final RegistryObject<Item> ORDINARY_SKEWER =
      ITEMS.register(
          "ordinary_skewer",
          () ->
              new CursedSkewerItem(
                  new Item.Properties()
                      .food(
                          new FoodProperties.Builder()
                              .nutrition(5)
                              .saturationMod(0.46F)
                              .alwaysEat()
                              .build())));
  public static final RegistryObject<Item> SOUR_SPICY_NOODLES =
      ITEMS.register(
          "sour_spicy_noodles",
          () ->
              new EffectFoodItem(
                  new Item.Properties()
                      .stacksTo(16)
                      .food(new FoodProperties.Builder().nutrition(10).saturationMod(0.6F).build()),
                  cookeryEffect("warmth"),
                  900,
                  "tooltip.kaleidoscope_grilling.sour_spicy_noodles.maxim"));

  static {
    multiBiteSkewer(
        "grilled_beef_skewer",
        5,
        0.6F,
        new ResourceLocation("minecraft", "strength"),
        10,
        MultiBiteSkewerItem.AnimationProfile.FOUR);
    skewer("grilled_pork_belly_skewer", 5, 0.6F, cookeryEffect("vigor"), 30);
    skewer(
        "grilled_chicken_skin_skewer",
        4,
        0.5F,
        new ResourceLocation("minecraft", "speed"),
        20);
    skewer("grilled_mid_wing_skewer", 7, 0.2143F, cookeryEffect("mustard"), 45);
    multiBiteSkewer(
        "grilled_squid_tentacle_skewer",
        5,
        0.4F,
        new ResourceLocation("minecraft", "water_breathing"),
        30,
        MultiBiteSkewerItem.AnimationProfile.THREE_RANDOM);
    skewer("grilled_fish_skewer", 6, 0.45F, cookeryEffect("tundra_strider"), 30);
    skewer(
        "grilled_sweet_potato_sheet_skewer",
        6,
        1.1667F,
        cookeryEffect("preservation"),
        45);
    skewer("grilled_potato_slice_skewer", 6, 0.1667F, cookeryEffect("warmth"), 30);
    skewer("grilled_caterpillar_skewer", 12, 0.0833F, cookeryEffect("flatulence"), 15);
    skewer(
        "grilled_mushroom_skewer",
        5,
        0.55F,
        new ResourceLocation("minecraft", "night_vision"),
        30);
    skewer("grilled_bun_slice_skewer", 5, 0.6F, null, 0);
    skewer(
        "grilled_ender_pearl_skewer", 4, 0.1F, cookeryEffect("projectile_dodge"), 30);
    skewer(
        "grilled_meatball_skewer",
        12,
        0.875F,
        new ResourceLocation("minecraft", "strength"),
        10);
    skewer("grilled_slime_skewer", 4, 0.0F, cookeryEffect("hinder"), 45);
    skewer("grilled_meat_and_bone_skewer", 4, 0.5F, cookeryEffect("vigor"), 20);
    skewer("grilled_fried_egg_skewer", 4, 0.375F, cookeryEffect("sulfur"), 60);
    skewer(
        "grilled_gluten_skewer",
        6,
        0.1F,
        new ResourceLocation("minecraft", "haste"),
        30);

    rawSkewer("raw_beef_skewer", 2, 0.3F, false);
    rawSkewer("raw_pork_belly_skewer", 2, 0.3F, false);
    rawSkewer("raw_chicken_skin_skewer", 2, 0.25F, false);
    rawSkewer("raw_mid_wing_skewer", 3, 0.1071F, false);
    rawSkewer("raw_squid_tentacle_skewer", 2, 0.2F, false);
    rawSkewer("raw_fish_skewer", 3, 0.225F, false);
    rawSkewer("raw_sweet_potato_sheet_skewer", 3, 0.5833F, false);
    rawSkewer("raw_potato_slice_skewer", 3, 0.0833F, false);
    rawSkewer("raw_caterpillar_skewer", 6, 0.0417F, true);
    rawSkewer("raw_mushroom_skewer", 2, 0.275F, false);
    rawSkewer("raw_bun_slice_skewer", 2, 0.3F, false);
    animatedRawSkewer(
        "raw_ender_pearl_skewer",
        2,
        0.05F,
        true,
        MultiBiteSkewerItem.AnimationProfile.THREE);
    rawSkewer("raw_meatball_skewer", 4, 0.4375F, false);
    rawSkewer("raw_slime_skewer", 2, 0.0F, true);
    rawSkewer("raw_meat_and_bone_skewer", 2, 0.25F, false);
    rawSkewer("raw_fried_egg_skewer", 2, 0.1875F, false);
    rawSkewer("raw_gluten_skewer", 3, 0.05F, false);
    RAW_SKEWERS.add(RAW_LAMB_SKEWER);
    RAW_SKEWERS.add(RAW_GOLDEN_SKEWER);
    FIXED_SKEWERS.add(GRILLED_LAMB_SKEWER);
    FIXED_SKEWERS.add(GRILLED_GOLDEN_SKEWER);
    FIXED_SKEWERS.add(ORDINARY_SKEWER);
  }

  private static ResourceLocation cookeryEffect(String path) {
    return new ResourceLocation("kaleidoscope_cookery", path);
  }

  private static ResourceLocation grillingEffect(String path) {
    return new ResourceLocation(KaleidoscopeGrilling.MOD_ID, path);
  }

  private static RegistryObject<Item> ingredient(String id) {
    return ingredient(id, () -> new Item(new Item.Properties()));
  }

  private static RegistryObject<Item> ingredient(String id, Supplier<? extends Item> factory) {
    RegistryObject<Item> item = ITEMS.register(id, factory);
    INGREDIENTS.add(item);
    return item;
  }

  private static RegistryObject<Item> dish(String id, int nutrition, float saturation) {
    return ITEMS.register(
        id,
        () ->
            new FlavorFoodItem(
                new Item.Properties()
                    .stacksTo(16)
                    .food(
                        new FoodProperties.Builder()
                            .nutrition(nutrition)
                            .saturationMod(saturation)
                            .build()),
                "tooltip.kaleidoscope_grilling." + id + ".maxim"));
  }

  private static void skewer(
      String id,
      int nutrition,
      float saturationModifier,
      ResourceLocation effectId,
      int effectSeconds) {
    FIXED_SKEWERS.add(
        ITEMS.register(
            id,
            () ->
                new MultiBiteSkewerItem(
                    new Item.Properties()
                        .food(
                            new FoodProperties.Builder()
                                .nutrition(nutrition)
                                .saturationMod(saturationModifier)
                                .build()),
                    "tooltip.kaleidoscope_grilling." + id + ".maxim",
                    effectId,
                    effectSeconds * 20,
                    animationProfile(id))));
  }

  private static void multiBiteSkewer(
      String id,
      int nutrition,
      float saturationModifier,
      ResourceLocation effectId,
      int effectSeconds,
      MultiBiteSkewerItem.AnimationProfile animationProfile) {
    FIXED_SKEWERS.add(
        ITEMS.register(
            id,
            () ->
                new MultiBiteSkewerItem(
                    new Item.Properties()
                        .food(
                            new FoodProperties.Builder()
                                .nutrition(nutrition)
                                .saturationMod(saturationModifier)
                                .build()),
                    "tooltip.kaleidoscope_grilling." + id + ".maxim",
                    effectId,
                    effectSeconds * 20,
                    animationProfile)));
  }

  private static void rawSkewer(
      String id, int nutrition, float saturationModifier, boolean nausea) {
    FoodProperties.Builder food =
        new FoodProperties.Builder().nutrition(nutrition).saturationMod(saturationModifier);
    RAW_SKEWERS.add(
        ITEMS.register(
            id,
            () ->
                new MultiBiteSkewerItem(
                    new Item.Properties().food(food.build()),
                    null,
                    nausea ? new ResourceLocation("minecraft", "nausea") : null,
                    nausea ? 60 : 0,
                    animationProfile(id))));
  }

  private static void animatedRawSkewer(
      String id,
      int nutrition,
      float saturationModifier,
      boolean nausea,
      MultiBiteSkewerItem.AnimationProfile animationProfile) {
    FoodProperties.Builder food =
        new FoodProperties.Builder().nutrition(nutrition).saturationMod(saturationModifier);
    RAW_SKEWERS.add(
        ITEMS.register(
            id,
            () ->
                new MultiBiteSkewerItem(
                    new Item.Properties().food(food.build()),
                    null,
                    nausea ? new ResourceLocation("minecraft", "nausea") : null,
                    nausea ? 60 : 0,
                    animationProfile)));
  }

  private static MultiBiteSkewerItem.AnimationProfile animationProfile(String id) {
    String name = id.replace("raw_", "").replace("grilled_", "");
    if (name.equals("fish_skewer") || name.equals("caterpillar_skewer"))
      return MultiBiteSkewerItem.AnimationProfile.ONE;
    if (name.equals("bun_slice_skewer")
        || name.equals("fried_egg_skewer")
        || name.equals("slime_skewer")
        || name.equals("sweet_potato_sheet_skewer"))
      return MultiBiteSkewerItem.AnimationProfile.TWO;
    if (name.equals("beef_skewer")
        || name.equals("chicken_skin_skewer")
        || name.equals("pork_belly_skewer"))
      return MultiBiteSkewerItem.AnimationProfile.FOUR;
    if (name.equals("ender_pearl_skewer")) return MultiBiteSkewerItem.AnimationProfile.THREE;
    return MultiBiteSkewerItem.AnimationProfile.THREE_RANDOM;
  }

  private ModItems() {}
}
