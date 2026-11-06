package cn.breezeth.kaleidoscope_grilling.skewer;

import cn.breezeth.kaleidoscope_grilling.KaleidoscopeGrilling;

import com.mojang.blaze3d.platform.NativeImage;
import com.mojang.logging.LogUtils;
import java.io.IOException;
import java.io.InputStream;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.item.ItemStack;
import org.slf4j.Logger;

final class CustomSkewerGuiTexture {
  private static final Logger LOGGER = LogUtils.getLogger();
  private static final int SIZE = 16;
  private static final int SLOT_STRIDE = 128;
  private static final NativeImage[][] FOOD_MASKS = new NativeImage[3][2];
  private static NativeImage stick;
  private static boolean templatesFailed;

  static ResourceLocation bake(ItemStack stack, ResourceLocation textureId) {
    Minecraft minecraft = Minecraft.getInstance();
    if (!loadTemplates(minecraft)) return null;
    NativeImage result = new NativeImage(SIZE, SIZE, true);
    try {
      result.copyFrom(stick);
      int variants = variantBits(stack, minecraft);
      for (int slot = 2; slot >= 0; slot--) {
        paintMask(result, FOOD_MASKS[slot][variants >>> slot & 1], stack, slot);
      }
      DynamicTexture texture = new DynamicTexture(result);
      result = null;
      texture.setFilter(false, false);
      minecraft.getTextureManager().register(textureId, texture);
      return textureId;
    } catch (RuntimeException exception) {
      LOGGER.warn("Unable to compose a custom skewer GUI icon", exception);
      return null;
    } finally {
      if (result != null) result.close();
    }
  }

  static void clearTemplates() {
    if (stick != null) stick.close();
    stick = null;
    templatesFailed = false;
    for (int slot = 0; slot < FOOD_MASKS.length; slot++) {
      for (int variant = 0; variant < FOOD_MASKS[slot].length; variant++) {
        if (FOOD_MASKS[slot][variant] != null) FOOD_MASKS[slot][variant].close();
        FOOD_MASKS[slot][variant] = null;
      }
    }
  }

  private static boolean loadTemplates(Minecraft minecraft) {
    if (stick != null) return true;
    if (templatesFailed) return false;
    try {
      stick = read(minecraft, "stick");
      for (int slot = 0; slot < 3; slot++) {
        for (int variant = 0; variant < 2; variant++) {
          FOOD_MASKS[slot][variant] =
              read(minecraft, "food_" + (slot + 1) + "_" + (variant + 1));
        }
      }
      return true;
    } catch (IOException | RuntimeException exception) {
      clearTemplates();
      templatesFailed = true;
      LOGGER.warn("Unable to load custom skewer GUI templates", exception);
      return false;
    }
  }

  private static NativeImage read(Minecraft minecraft, String name) throws IOException {
    ResourceLocation location =
        ResourceLocation.fromNamespaceAndPath(
            KaleidoscopeGrilling.MOD_ID,
            "textures/item/custom_skewer_gui_16/" + name + ".png");
    try (InputStream input = minecraft.getResourceManager().open(location)) {
      NativeImage image = NativeImage.read(input);
      if (image.getWidth() != SIZE || image.getHeight() != SIZE) {
        image.close();
        throw new IOException("Expected a 16x16 template: " + location);
      }
      return image;
    }
  }

  private static void paintMask(
      NativeImage target, NativeImage mask, ItemStack stack, int slot) {
    int minX = SIZE;
    int minY = SIZE;
    int maxX = -1;
    int maxY = -1;
    for (int y = 0; y < SIZE; y++) {
      for (int x = 0; x < SIZE; x++) {
        if (alpha(mask, x, y) == 0) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    if (maxX < minX || maxY < minY) return;
    int ingredientColor = ingredientBaseColor(stack, slot);
    if (ingredientColor == -1) return;
    for (int y = minY; y <= maxY; y++) {
      for (int x = minX; x <= maxX; x++) {
        int maskAlpha = alpha(mask, x, y);
        if (maskAlpha == 0) continue;
        int argb = applyMaskTone(ingredientColor, mask.getPixelRGBA(x, y));
        target.setPixelRGBA(x, y, toAbgr(argb, maskAlpha));
      }
    }
  }

  private static int ingredientBaseColor(ItemStack stack, int slot) {
    int[] centerCells = {5, 6, 9, 10};
    long red = 0;
    long green = 0;
    long blue = 0;
    int count = 0;
    for (int cell : centerCells) {
      int color = SkewerColorProvider.color(stack, slot * SLOT_STRIDE + cell);
      if (color == -1) continue;
      red += color >>> 16 & 0xFF;
      green += color >>> 8 & 0xFF;
      blue += color & 0xFF;
      count++;
    }
    if (count == 0) return -1;
    return 0xFF000000
        | (int) (red / count) << 16
        | (int) (green / count) << 8
        | (int) (blue / count);
  }

  private static int applyMaskTone(int argb, int maskAbgr) {
    int marker = maskAbgr & 0xFF;
    int tone = Math.max(0, Math.min(4, Math.round((marker - 0x30) / 48.0F)));
    int red = argb >>> 16 & 0xFF;
    int green = argb >>> 8 & 0xFF;
    int blue = argb & 0xFF;
    if (tone < 2) {
      float factor = tone == 0 ? 0.56F : 0.76F;
      red = Math.round(red * factor);
      green = Math.round(green * factor);
      blue = Math.round(blue * factor);
    } else if (tone > 2) {
      float amount = tone == 3 ? 0.18F : 0.36F;
      red = Math.round(red + (255 - red) * amount);
      green = Math.round(green + (255 - green) * amount);
      blue = Math.round(blue + (255 - blue) * amount);
    }
    return argb & 0xFF000000 | red << 16 | green << 8 | blue;
  }

  static int variantBits(ItemStack stack, Minecraft minecraft) {
    return SkeweringHandler.guiVariantBits(stack);
  }

  private static int alpha(NativeImage image, int x, int y) {
    return image.getPixelRGBA(x, y) >>> 24;
  }

  private static int toAbgr(int argb, int alpha) {
    return alpha << 24
        | (argb & 0xFF) << 16
        | (argb & 0xFF00)
        | (argb >>> 16 & 0xFF);
  }

  private CustomSkewerGuiTexture() {}
}
