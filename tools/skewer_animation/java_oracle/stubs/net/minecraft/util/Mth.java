package net.minecraft.util;
/** Test dependency surrogate. Lookup mode emulates the vanilla float sine table;
 * it is not a loaded Minecraft client class. Math mode is an explicit comparison. */
public final class Mth {
  public static final float DEG_TO_RAD = (float)Math.PI / 180.0F;
  private static final float[] SIN = new float[65536];
  static { for (int i=0;i<SIN.length;i++) SIN[i]=(float)Math.sin(i*Math.PI*2.0/65536.0); }
  public static float clamp(float x,float lo,float hi) { return x < lo ? lo : Math.min(x,hi); }
  public static float sin(float x) { return Boolean.getBoolean("oracle.mathTrig") ? (float)Math.sin(x) : SIN[(int)(x*10430.378F)&65535]; }
  public static float cos(float x) { return Boolean.getBoolean("oracle.mathTrig") ? (float)Math.cos(x) : SIN[(int)(x*10430.378F+16384.0F)&65535]; }
}
