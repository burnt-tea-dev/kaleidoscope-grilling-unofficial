package com.mojang.math;
/** Records rotation requests, deliberately does not pretend to execute JOML. */
public enum Axis { XP,YP,ZP;
 public record Rotation(String axis,float degrees) {}
 public Rotation rotationDegrees(float degrees){return new Rotation(name().substring(0,1),degrees);}
}
