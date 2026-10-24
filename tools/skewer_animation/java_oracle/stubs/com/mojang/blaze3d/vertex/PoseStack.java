package com.mojang.blaze3d.vertex;
import java.util.*;
import com.mojang.math.Axis;
/** Recorder of ordered API calls, NOT an engine matrix/normal stack implementation. */
public class PoseStack {
 public final List<Object> operations=new ArrayList<>();
 public void translate(double x,double y,double z){operations.add(List.of("translate",x,y,z));}
 public void mulPose(Axis.Rotation r){operations.add(List.of("rotate_degrees",r.axis(),r.degrees()));}
 public void scale(float x,float y,float z){operations.add(List.of("scale",x,y,z));}
}
