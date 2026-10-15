package cn.breezeth.kaleidoscope_grilling.client;

import cn.breezeth.kaleidoscope_grilling.KaleidoscopeGrilling;
import cn.breezeth.kaleidoscope_grilling.registry.ModBlockEntities;
import cn.breezeth.kaleidoscope_grilling.registry.ModBlocks;
import cn.breezeth.kaleidoscope_grilling.registry.ModItems;
import cn.breezeth.kaleidoscope_grilling.registry.ModMenus;

import cn.breezeth.kaleidoscope_grilling.rack.AdvancedRackRenderer;
import cn.breezeth.kaleidoscope_grilling.rack.AdvancedRackScreen;
import cn.breezeth.kaleidoscope_grilling.oil.AnvilPressAnimationAccess;
import cn.breezeth.kaleidoscope_grilling.oil.BigVatRenderer;
import cn.breezeth.kaleidoscope_grilling.skewer.FailedSkewerData;
import cn.breezeth.kaleidoscope_grilling.food.FoodState;
import cn.breezeth.kaleidoscope_grilling.grill.GrillRenderer;
import cn.breezeth.kaleidoscope_grilling.skewer.MultiBiteSkewerItem;
import cn.breezeth.kaleidoscope_grilling.oil.OilPotCompat;
import cn.breezeth.kaleidoscope_grilling.rack.RackSelectionScreen;
import cn.breezeth.kaleidoscope_grilling.rack.RackShortcutScreen;
import cn.breezeth.kaleidoscope_grilling.seasoning.SeasoningBottleRenderer;
import cn.breezeth.kaleidoscope_grilling.seasoning.SeasoningColorProvider;
import cn.breezeth.kaleidoscope_grilling.seasoning.SeasoningData;
import cn.breezeth.kaleidoscope_grilling.skewer.SecretSkewerItem;
import cn.breezeth.kaleidoscope_grilling.skewer.SkewerColorProvider;
import cn.breezeth.kaleidoscope_grilling.skewer.SkewerGuiDecorator;
import cn.breezeth.kaleidoscope_grilling.skewer.SkewerGuiIconCache;
import cn.breezeth.kaleidoscope_grilling.skewer.SkeweringHandler;
import cn.breezeth.kaleidoscope_grilling.skewer.SkewerOutlineRender;
import cn.breezeth.kaleidoscope_grilling.skewer.SkewerPlateRenderer;
import cn.breezeth.kaleidoscope_grilling.skewer.SkewerRecipeBlockRenderer;
import cn.breezeth.kaleidoscope_grilling.skewer.SkewerRecipes;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.MenuScreens;
import net.minecraft.client.renderer.ItemBlockRenderTypes;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.client.renderer.blockentity.BlockEntityRenderers;
import net.minecraft.client.renderer.item.ItemProperties;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.packs.resources.ResourceManagerReloadListener;
import net.minecraft.world.item.Item;
import net.minecraft.world.level.block.Block;
import net.minecraftforge.api.distmarker.Dist;
import net.minecraftforge.client.event.ModelEvent;
import net.minecraftforge.client.event.RegisterClientReloadListenersEvent;
import net.minecraftforge.client.event.RegisterColorHandlersEvent;
import net.minecraftforge.client.event.RegisterItemDecorationsEvent;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.event.lifecycle.FMLClientSetupEvent;
import net.minecraftforge.registries.ForgeRegistries;

@Mod.EventBusSubscriber(
    modid = KaleidoscopeGrilling.MOD_ID,
    bus = Mod.EventBusSubscriber.Bus.MOD,
    value = Dist.CLIENT)
public final class ClientSetup {
  private static final ResourceLocation SKEWER_STATE =
      new ResourceLocation(KaleidoscopeGrilling.MOD_ID, "skewer_state");
  private static final ResourceLocation SKEWER_OUTLINE =
      new ResourceLocation(KaleidoscopeGrilling.MOD_ID, "skewer_outline");
  private static final ResourceLocation SKEWER_HOT =
      new ResourceLocation(KaleidoscopeGrilling.MOD_ID, "skewer_hot");
  private static final ResourceLocation SKEWER_COOKING_STAGE =
      new ResourceLocation(KaleidoscopeGrilling.MOD_ID, "skewer_cooking_stage");
  private static final ResourceLocation SKEWER_BITE_STAGE =
      new ResourceLocation(KaleidoscopeGrilling.MOD_ID, "skewer_bite_stage");
  private static final ResourceLocation SLIME_SKEWER_FRAME =
      new ResourceLocation(KaleidoscopeGrilling.MOD_ID, "slime_skewer_frame");
  private static final ResourceLocation FAILED_SKEWER_SOURCE =
      new ResourceLocation(KaleidoscopeGrilling.MOD_ID, "failed_skewer_source");
  private static final ResourceLocation OIL_TYPE =
      new ResourceLocation(KaleidoscopeGrilling.MOD_ID, "oil_type");
  private static final ResourceLocation OIL_BRUSHING =
      new ResourceLocation(KaleidoscopeGrilling.MOD_ID, "oil_brushing");
  private static final ResourceLocation SEASONING_FILL =
      new ResourceLocation(KaleidoscopeGrilling.MOD_ID, "seasoning_fill");
  private static final ResourceLocation SEASONING_REMAINING =
      new ResourceLocation(KaleidoscopeGrilling.MOD_ID, "seasoning_remaining");
  private static final ResourceLocation SEASONING_VARIANT =
      new ResourceLocation(KaleidoscopeGrilling.MOD_ID, "seasoning_variant");

  @SubscribeEvent
  public static void onClientSetup(FMLClientSetupEvent event) {
    event.enqueueWork(
        () -> {
          MenuScreens.register(ModMenus.ADVANCED_RACK.get(), AdvancedRackScreen::new);
          MenuScreens.register(ModMenus.RACK_SELECTION.get(), RackSelectionScreen::new);
          MenuScreens.register(ModMenus.RACK_SHORTCUT.get(), RackShortcutScreen::new);
          BlockEntityRenderers.register(ModBlockEntities.GRILL.get(), GrillRenderer::new);
          BlockEntityRenderers.register(
              ModBlockEntities.SEASONING_BOTTLE.get(), SeasoningBottleRenderer::new);
          BlockEntityRenderers.register(ModBlockEntities.BIG_VAT.get(), BigVatRenderer::new);
          BlockEntityRenderers.register(
              ModBlockEntities.ADVANCED_RACK.get(), AdvancedRackRenderer::new);
          BlockEntityRenderers.register(
              ModBlockEntities.SKEWER_RECIPE.get(), SkewerRecipeBlockRenderer::new);
          BlockEntityRenderers.register(
              ModBlockEntities.SKEWER_PLATE.get(), SkewerPlateRenderer::new);
          register(ModItems.UNFINISHED_SKEWER.get());
          register(ModItems.SECRET_SKEWER.get());
          register(ModItems.MYSTERIOUS_SKEWER.get());
          register(ModItems.DARK_GRILLING.get());
          ModItems.RAW_SKEWERS.forEach(item -> registerFixed(item.get()));
          ModItems.FIXED_SKEWERS.forEach(item -> registerFixed(item.get()));
          ForgeRegistries.ITEMS.getValues().stream()
              .filter(ClientSetup::isGeneratedKubeSkewer)
              .forEach(ClientSetup::registerGeneratedSkewer);
          Item cookedSlimeSkewer =
              ForgeRegistries.ITEMS.getValue(
                  new ResourceLocation(KaleidoscopeGrilling.MOD_ID, "grilled_slime_skewer"));
          if (cookedSlimeSkewer != null)
            ItemProperties.register(
                cookedSlimeSkewer,
                SLIME_SKEWER_FRAME,
                (stack, level, entity, seed) ->
                    level == null ? 0.0F : (level.getGameTime() / 4L % 5L) / 4.0F);
          ItemProperties.register(
              ModItems.MYSTERIOUS_SKEWER.get(),
              FAILED_SKEWER_SOURCE,
              (stack, level, entity, seed) -> FailedSkewerData.modelValue(stack));
          ItemProperties.register(
              ModItems.DARK_GRILLING.get(),
              FAILED_SKEWER_SOURCE,
              (stack, level, entity, seed) -> FailedSkewerData.modelValue(stack));
          Item oilPot =
              ForgeRegistries.ITEMS.getValue(
                  new ResourceLocation("kaleidoscope_cookery", "oil_pot"));
          if (oilPot != null)
            ItemProperties.register(
                oilPot,
                OIL_TYPE,
                (stack, level, entity, seed) ->
                    OilPotCompat.getCount(stack) > 0
                        ? oilTypeModelValue(OilPotCompat.getType(stack))
                        : 0F);
          if (oilPot != null)
            ItemProperties.register(
                oilPot,
                OIL_BRUSHING,
                (stack, level, entity, seed) -> oilBrushModelValue(stack, entity));
          Block oilPotBlock =
              ForgeRegistries.BLOCKS.getValue(
                  new ResourceLocation("kaleidoscope_cookery", "oil_pot"));
          if (oilPotBlock != null)
            ItemBlockRenderTypes.setRenderLayer(oilPotBlock, RenderType.cutout());
          ItemBlockRenderTypes.setRenderLayer(
              ModBlocks.SEASONING_BOTTLE.get(), RenderType.translucent());
          ItemBlockRenderTypes.setRenderLayer(ModBlocks.BIG_VAT.get(), RenderType.translucent());
          ItemBlockRenderTypes.setRenderLayer(ModBlocks.ADVANCED_RACK.get(), RenderType.cutout());
          ItemBlockRenderTypes.setRenderLayer(ModBlocks.SKEWER_RECIPE.get(), RenderType.cutout());
          ItemBlockRenderTypes.setRenderLayer(ModBlocks.SKEWER_PLATE.get(), RenderType.cutout());
          ItemBlockRenderTypes.setRenderLayer(ModBlocks.PEPPER_LEAVES.get(), RenderType.cutout());
          ItemBlockRenderTypes.setRenderLayer(ModBlocks.PEPPER_SAPLING.get(), RenderType.cutout());
          ItemProperties.register(
              ModItems.EMPTY_SEASONING_BOTTLE.get(),
              SEASONING_FILL,
              (stack, level, entity, seed) -> Math.min(8, SeasoningData.get(stack).size()) / 8.0F);
          ItemProperties.register(
              ModItems.PENDING_SEASONING.get(),
              SEASONING_FILL,
              (stack, level, entity, seed) -> Math.min(8, SeasoningData.get(stack).size()) / 8.0F);
          ItemProperties.register(
              ModItems.SPECIAL_SEASONING.get(),
              SEASONING_REMAINING,
              (stack, level, entity, seed) ->
                  Math.min(
                          8,
                          (SeasoningData.MAX_USES - SeasoningData.getUses(stack) + 1) / 2)
                      / 8.0F);
          ItemProperties.register(
              ModItems.SPECIAL_SEASONING.get(),
              SEASONING_VARIANT,
              (stack, level, entity, seed) -> SeasoningData.getVariant(stack) / 7.0F);
        });
  }

  @SubscribeEvent
  public static void registerItemColors(RegisterColorHandlersEvent.Item event) {
    event.register(
        SkewerColorProvider::color, ModItems.UNFINISHED_SKEWER.get(), ModItems.SECRET_SKEWER.get());
    ModItems.RAW_SKEWERS.forEach(item -> event.register(SkewerColorProvider::color, item.get()));
    ModItems.FIXED_SKEWERS.forEach(item -> event.register(SkewerColorProvider::color, item.get()));
    ForgeRegistries.ITEMS.getValues().stream()
        .filter(ClientSetup::isGeneratedKubeSkewer)
        .forEach(item -> event.register(SkewerColorProvider::color, item));
    event.register(
        SeasoningColorProvider::color,
        ModItems.EMPTY_SEASONING_BOTTLE.get(),
        ModItems.PENDING_SEASONING.get());
  }

  @SubscribeEvent
  public static void registerItemDecorations(RegisterItemDecorationsEvent event) {
    SkewerGuiDecorator decorator = new SkewerGuiDecorator();
    event.register(ModItems.UNFINISHED_SKEWER.get(), decorator);
    event.register(ModItems.SECRET_SKEWER.get(), decorator);
    ForgeRegistries.ITEMS.getValues().stream()
        .filter(ClientSetup::isGeneratedKubeSkewer)
        .forEach(item -> event.register(item, decorator));
  }

  /** Called after a server-script sync, including after /reload. */
  public static void refreshScriptSkewerRendering() {
    Minecraft minecraft = Minecraft.getInstance();
    ForgeRegistries.ITEMS.getValues().stream()
        .filter(
            item ->
                SkewerRecipes.usesGeneratedModel(
                    new net.minecraft.world.item.ItemStack(item)))
        .forEach(
            item -> {
              registerGeneratedSkewer(item);
              minecraft.getItemColors().register(SkewerColorProvider::color, item);
            });
    SkewerColorProvider.clearCache();
    SkewerGuiIconCache.clear();
  }

  @SubscribeEvent
  public static void registerAdditionalModels(ModelEvent.RegisterAdditional event) {
    event.register(new ResourceLocation(KaleidoscopeGrilling.MOD_ID, "item/skewer_plate_base"));
    for (String base : new String[] {"fish_skewer", "caterpillar_skewer"}) {
      event.register(new ResourceLocation(KaleidoscopeGrilling.MOD_ID, fixedPiecePath(base, "_raw_piece_1")));
      event.register(new ResourceLocation(KaleidoscopeGrilling.MOD_ID, fixedPiecePath(base, "_piece_1")));
    }
    String[] threePieceSkewers = {
        "ender_pearl_skewer", "golden_skewer", "gluten_skewer", "lamb_skewer", "meat_and_bone_skewer",
        "meatball_skewer", "mid_wing_skewer", "mushroom_skewer", "ordinary_skewer",
        "potato_slice_skewer", "squid_tentacle_skewer"
    };
    for (String base : threePieceSkewers) {
      event.register(new ResourceLocation(KaleidoscopeGrilling.MOD_ID, fixedPiecePath(base, "_piece_3")));
      if (!base.equals("ordinary_skewer")) {
        event.register(new ResourceLocation(KaleidoscopeGrilling.MOD_ID, fixedPiecePath(base, "_raw_piece_3")));
      }
    }
    event.register(new ResourceLocation(KaleidoscopeGrilling.MOD_ID, "block/pot_oil_default"));
    event.register(new ResourceLocation(KaleidoscopeGrilling.MOD_ID, "block/pot_oil_canola"));
    event.register(new ResourceLocation(KaleidoscopeGrilling.MOD_ID, "block/pot_oil_secret_chili"));
    event.register(
        new ResourceLocation(KaleidoscopeGrilling.MOD_ID, "block/pot_oil_premium_chili"));
  }

  @SubscribeEvent
  public static void registerReloadListener(RegisterClientReloadListenersEvent event) {
    event.registerReloadListener(
        (ResourceManagerReloadListener) manager -> SkewerGuiIconCache.clear());
    event.registerReloadListener(
        (ResourceManagerReloadListener) manager -> SkewerColorProvider.clearCache());
    event.registerReloadListener(
        (ResourceManagerReloadListener) manager -> SeasoningColorProvider.clearCache());
  }

  private static void register(Item item) {
    ItemProperties.register(
        item,
        SKEWER_STATE,
        (stack, level, entity, seed) -> SkeweringHandler.modelState(stack) / 64.0F);
    ItemProperties.register(
        item,
        SKEWER_OUTLINE,
        (stack, level, entity, seed) -> SkewerOutlineRender.isActive() ? 1.0F : 0.0F);
    if (item instanceof MultiBiteSkewerItem)
      ItemProperties.register(
          item,
          SKEWER_BITE_STAGE,
          (stack, level, entity, seed) -> MultiBiteSkewerItem.visualBiteStage(stack, entity));
  }

  private static void registerFixed(Item item) {
    ItemProperties.register(
        item,
        SKEWER_HOT,
        (stack, level, entity, seed) ->
            level != null && FoodState.isHot(stack, level) ? 1.0F : 0.0F);
    ItemProperties.register(
        item,
        SKEWER_COOKING_STAGE,
        (stack, level, entity, seed) -> SecretSkewerItem.getVisualStage(stack) / 5.0F);
    if (item instanceof MultiBiteSkewerItem)
      ItemProperties.register(
          item,
          SKEWER_BITE_STAGE,
          (stack, level, entity, seed) -> MultiBiteSkewerItem.visualBiteStage(stack, entity));
  }

  private static void registerGeneratedSkewer(Item item) {
    register(item);
    registerFixed(item);
  }

  private static boolean isGeneratedKubeSkewer(Item item) {
    if (!item.getClass().getName().equals(
        "cn.breezeth.kaleidoscope_grilling.kubejs.KubeSkewerItem")) return false;
    try {
      return Boolean.TRUE.equals(item.getClass().getMethod("usesGeneratedModel").invoke(item));
    } catch (ReflectiveOperationException ignored) {
      return false;
    }
  }

  private static float oilTypeModelValue(String type) {
    return switch (type) {
      case "canola" -> 0.25F;
      case "secret_chili" -> 0.5F;
      case "premium_chili" -> 0.75F;
      default -> 0F;
    };
  }

  private static String fixedPiecePath(String base, String suffix) {
    String folder = base.endsWith("_skewer") ? base.substring(0, base.length() - 7) : base;
    return "item/fixed_skewers/" + folder + "/" + base + suffix;
  }

  private static float oilBrushModelValue(
      net.minecraft.world.item.ItemStack stack, net.minecraft.world.entity.LivingEntity entity) {
    if (!(entity instanceof net.minecraft.world.entity.player.Player player)
        || !(player instanceof AnvilPressAnimationAccess animation)
        || animation.grilling$getOilBrushProgress(Minecraft.getInstance().getPartialTick()) < 0.0F
        || player.getItemInHand(animation.grilling$getOilBrushHand()) != stack) return 0F;
    return (animation.grilling$getOilBrushType() + 1.0F) * 0.25F;
  }

  private ClientSetup() {}
}
