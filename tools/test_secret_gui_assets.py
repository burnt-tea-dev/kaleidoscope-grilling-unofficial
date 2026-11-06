"""Compare generated icon layers with both unchanged Java GUI composers.

Only Minecraft's image/resource boundary, palette values and ItemStack are
substituted. The Java mask ordering, tone calculation and bake implementation
come from the pinned public upstream source, not a second test algorithm.
This is pixel evidence, not a Minecraft client binding/rendering test.
"""
from pathlib import Path
import shutil
import subprocess
import tempfile
from PIL import Image
from build_secret_gui import FIX, RP, TEXTURES, STYLES, source_data

PACKAGE = 'cn/breezeth/kaleidoscope_grilling/skewer'
STUBS = {
    'org/slf4j/Logger.java': '''package org.slf4j; public interface Logger { default void warn(String s,Throwable t){throw new RuntimeException(s,t);} }''',
    'com/mojang/logging/LogUtils.java': '''package com.mojang.logging; public class LogUtils { public static org.slf4j.Logger getLogger(){return new org.slf4j.Logger(){};} }''',
    'cn/breezeth/kaleidoscope_grilling/KaleidoscopeGrilling.java': '''package cn.breezeth.kaleidoscope_grilling; public class KaleidoscopeGrilling { public static final String MOD_ID="kaleidoscope_grilling"; }''',
    'net/minecraft/resources/ResourceLocation.java': '''package net.minecraft.resources;
public class ResourceLocation { public String path; public ResourceLocation(String n,String p){path=p;}
public static ResourceLocation fromNamespaceAndPath(String n,String p){return new ResourceLocation(n,p);} }''',
    'net/minecraft/world/item/ItemStack.java': '''package net.minecraft.world.item; public class ItemStack { public int[] colors; public int variants; }''',
    'com/mojang/blaze3d/platform/NativeImage.java': '''package com.mojang.blaze3d.platform;
import java.awt.image.BufferedImage; import java.io.*; import javax.imageio.ImageIO;
public class NativeImage implements AutoCloseable {
 public BufferedImage image;
 public NativeImage(int w,int h,boolean clear){image=new BufferedImage(w,h,BufferedImage.TYPE_INT_ARGB);}
 public static NativeImage read(InputStream input)throws IOException{NativeImage n=new NativeImage(1,1,true);n.image=ImageIO.read(input);return n;}
 public int getWidth(){return image.getWidth();} public int getHeight(){return image.getHeight();}
 private static int swap(int color){return (color&0xff00ff00)|((color>>>16)&255)|((color&255)<<16);}
 public int getPixelRGBA(int x,int y){return swap(image.getRGB(x,y));}
 public void setPixelRGBA(int x,int y,int color){image.setRGB(x,y,swap(color));}
 public void copyFrom(NativeImage other){image.setRGB(0,0,getWidth(),getHeight(),other.image.getRGB(0,0,getWidth(),getHeight(),null,0,getWidth()),0,getWidth());}
 public void close(){}
}''',
    'net/minecraft/client/renderer/texture/DynamicTexture.java': '''package net.minecraft.client.renderer.texture;
public class DynamicTexture { public com.mojang.blaze3d.platform.NativeImage image;
public DynamicTexture(com.mojang.blaze3d.platform.NativeImage n){image=n;} public void setFilter(boolean a,boolean b){} }''',
    'net/minecraft/client/Minecraft.java': '''package net.minecraft.client;
import java.nio.file.*; import java.io.*; import net.minecraft.resources.ResourceLocation;
import net.minecraft.client.renderer.texture.DynamicTexture;
public class Minecraft {
 public static Path root; public static Minecraft instance=new Minecraft(); public static DynamicTexture last;
 public static Minecraft getInstance(){return instance;}
 public Minecraft getResourceManager(){return this;} public Minecraft getTextureManager(){return this;}
 public InputStream open(ResourceLocation r)throws IOException{return Files.newInputStream(root.resolve(Path.of(r.path).getFileName()));}
 public void register(ResourceLocation r,DynamicTexture texture){last=texture;}
}''',
    PACKAGE+'/SkewerColorProvider.java': '''package cn.breezeth.kaleidoscope_grilling.skewer;
public class SkewerColorProvider { public static int color(net.minecraft.world.item.ItemStack stack,int tint){return stack.colors[tint/128];} }''',
    PACKAGE+'/SkeweringHandler.java': '''package cn.breezeth.kaleidoscope_grilling.skewer;
public class SkeweringHandler { public static int guiVariantBits(net.minecraft.world.item.ItemStack stack){return stack.variants;} }''',
    PACKAGE+'/GuiReference.java': '''package cn.breezeth.kaleidoscope_grilling.skewer;
import java.io.*; import java.nio.file.*; import javax.imageio.ImageIO;
import net.minecraft.client.Minecraft; import net.minecraft.resources.ResourceLocation; import net.minecraft.world.item.ItemStack;
public class GuiReference {
 public static void main(String[] args)throws Exception{
  Minecraft.root=Path.of(args[0]); Path output=Path.of(args[1]);
  BufferedReader input=new BufferedReader(new InputStreamReader(System.in)); String line;
  while((line=input.readLine())!=null){String[] p=line.split(" "); ItemStack stack=new ItemStack();
   stack.colors=new int[]{Integer.parseInt(p[0]),Integer.parseInt(p[1]),Integer.parseInt(p[2])};stack.variants=Integer.parseInt(p[3]);
   if(CustomSkewerGuiTexture.bake(stack,new ResourceLocation("qa",p[4]))==null)throw new IllegalStateException("Java bake failed");
   ImageIO.write(Minecraft.last.image.image,"png",output.resolve(p[4]+".png").toFile());
  }
 }
}'''
}


def pixels(image):
    # Transparent RGB is not visible and may differ between image backends.
    return [pixel if pixel[3] else (0, 0, 0, 0) for pixel in image.convert('RGBA').get_flattened_data()]


def main():
    colors = source_data()['colors']
    cases = []
    for food in range(1, len(colors)):
        foods = [food, 1+(food+37)%(len(colors)-1), 1+(food+113)%(len(colors)-1)]
        for style in STYLES:
            for variants in range(8):
                cases.append((foods, style, variants))
    with tempfile.TemporaryDirectory(prefix='grilling-gui-java-') as temporary:
        root = Path(temporary)
        for name, source in STUBS.items():
            path = root/name;path.parent.mkdir(parents=True, exist_ok=True);path.write_text(source)
        vectors = '\n'.join(' '.join(map(str, [*(colors[i][style] for i in foods), variants, number]))
                            for number, (foods, style, variants) in enumerate(cases))+'\n'
        for branch in ['forge-1.20.1', 'neoforge-1.21.1']:
            shutil.copy2(FIX/branch/'CustomSkewerGuiTexture.java', root/PACKAGE/'CustomSkewerGuiTexture.java')
            classes = root/branch;classes.mkdir()
            subprocess.run(['javac', '-d', str(classes), *(str(p) for p in root.rglob('*.java'))], check=True, capture_output=True, text=True)
            images = root/(branch+'-images');images.mkdir()
            subprocess.run(['java', '-Xmx128m', '-Djava.awt.headless=true', '-cp', str(classes),
                            'cn.breezeth.kaleidoscope_grilling.skewer.GuiReference', str(FIX), str(images)],
                           input=vectors, check=True, capture_output=True, text=True)
            for number, (foods, style, variants) in enumerate(cases):
                actual = Image.open(RP/(TEXTURES+'/stick.png')).convert('RGBA')
                for slot in [2, 1, 0]:
                    layer = RP/(TEXTURES+f'/food_{slot}_{(variants>>slot)&1}_{style}_{foods[slot]}.png')
                    actual.alpha_composite(Image.open(layer).convert('RGBA'))
                reference = Image.open(images/f'{number}.png')
                if pixels(actual) != pixels(reference):
                    raise SystemExit(f'GUI pixels differ: {branch}, foods={foods}, style={style}, variants={variants}')
            print(f'{branch}: {len(cases)} generated composites match the unchanged Java bake')


if __name__ == '__main__':
    main()
