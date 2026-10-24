import java.lang.reflect.*;
import java.util.*;
import cn.breezeth.kaleidoscope_grilling.skewer.*;
import cn.breezeth.kaleidoscope_grilling.skewer.MultiBiteSkewerItem.AnimationProfile;
import net.minecraft.world.entity.HumanoidArm;
import net.minecraft.world.entity.player.Player;
import net.minecraft.client.model.geom.ModelPart;
import com.mojang.blaze3d.vertex.PoseStack;

/** Executes original, hash-pinned animation classes against narrowly documented stubs. */
public final class OracleMain {
 static Object jsonValue(Object value) throws Exception {
  if(value==null || value instanceof Number || value instanceof Boolean || value instanceof String)return value;
  if(value.getClass().isRecord()) { Map<String,Object> r=new LinkedHashMap<>(); for(RecordComponent c:value.getClass().getRecordComponents())r.put(c.getName(),jsonValue(c.getAccessor().invoke(value)));return r; }
  if(value instanceof ModelPart p) return List.of(p.x,p.y,p.z,p.xRot,p.yRot,p.zRot);
  if(value instanceof Map<?,?> m){Map<String,Object> r=new LinkedHashMap<>();for(var e:m.entrySet())r.put(e.getKey().toString(),jsonValue(e.getValue()));return r;}
  if(value instanceof Iterable<?> l){List<Object> r=new ArrayList<>();for(Object v:l)r.add(jsonValue(v));return r;}
  throw new IllegalArgumentException("Unsupported "+value.getClass());
 }
 static String encode(Object value) {
  if(value==null)return "null";
  if(value instanceof Number || value instanceof Boolean)return value.toString();
  if(value instanceof String s)return "\""+s.replace("\\","\\\\").replace("\"","\\\"")+"\"";
  if(value instanceof Map<?,?> m){List<String> l=new ArrayList<>();for(var e:m.entrySet())l.add(encode(e.getKey().toString())+":"+encode(e.getValue()));return "{"+String.join(",",l)+"}";}
  if(value instanceof Iterable<?> a){List<String> l=new ArrayList<>();for(Object v:a)l.add(encode(v));return "["+String.join(",",l)+"]";}
  throw new IllegalArgumentException();
 }
 static void emit(AnimationProfile profile,HumanoidArm side,float seconds)throws Exception {
  int duration=profile==AnimationProfile.THREE?100:90;
  float ticks=seconds*20.0F; int used=(int)Math.floor(ticks);float partial=ticks-used;
  Player player=new Player(duration,duration-used);
  Map<String,Object> r=new LinkedHashMap<>();r.put("profile",profile.name());r.put("side",side.name());r.put("seconds_requested",seconds);r.put("used_ticks",used);r.put("partial_tick",partial);
  ModelPart active=new ModelPart();PoseStack main=new PoseStack();
  if(profile==AnimationProfile.ONE || profile==AnimationProfile.THREE){
   var pose=EnderPearlEatingAnimation.sample(player,partial,profile);r.put("source_pose",pose);
   EnderPearlEatingAnimation.applyActiveArm(active,side,pose.activeArm(),profile);
   ModelPart helper=new ModelPart();EnderPearlEatingAnimation.applyHelperArm(helper,side.getOpposite(),pose.helperArm(),profile);
   EnderPearlEatingAnimation.transformMainItem(main,side,pose.mainItem());
   PoseStack second=new PoseStack();EnderPearlEatingAnimation.transformSecondItem(second,side.getOpposite(),pose.secondItem(),profile);
   r.put("helper_side",side.getOpposite().name());r.put("applied_helper_arm",helper);r.put("second_item_ops",second.operations);r.put("second_item_rendered",pose.secondItem().scale()>0.001F);
  } else {
   var pose=SkewerEatingAnimation.sample(player,partial,profile);r.put("source_pose",pose);
   SkewerEatingAnimation.applyToArm(active,side,pose,profile);SkewerEatingAnimation.transformItem(main,side,pose);
   r.put("helper_side",null);r.put("applied_helper_arm",null);r.put("second_item_ops",List.of());r.put("second_item_rendered",false);
  }
  r.put("applied_active_arm",active);r.put("main_item_ops",main.operations);System.out.println(encode(jsonValue(r)));
 }
 public static void main(String[] args)throws Exception {
  if(args.length==3){emit(AnimationProfile.valueOf(args[0]),HumanoidArm.valueOf(args[1]),Float.parseFloat(args[2]));return;}
  if(args.length!=0)throw new IllegalArgumentException("usage: [PROFILE SIDE SECONDS]");
  TreeSet<Float> times=new TreeSet<>();for(int i=0;i<=200;i++)times.add(i/40.0F);times.add(-0.05F);times.add(5.05F);
  for(Class<?> c:List.of(SkewerEatingAnimation.class,EnderPearlEatingAnimation.class))for(Field f:c.getDeclaredFields())if(f.getType()==float[].class&&f.getName().endsWith("TIMES")){f.setAccessible(true);for(float t:(float[])f.get(null)){times.add(t);times.add(t-0.00001F);times.add(t+0.00001F);}}
  for(float t:new float[]{0.20833F,1.29167F,0.95833F,1.16667F,2.16667F,2.33333F,3.08333F,3.45833F,3.5F,3.54167F,4F,4.08333F}){times.add(t);times.add(t-0.00001F);times.add(t+0.00001F);}
  for(AnimationProfile p:List.of(AnimationProfile.ONE,AnimationProfile.TWO,AnimationProfile.THREE,AnimationProfile.THREE_ALT,AnimationProfile.FOUR))for(HumanoidArm side:HumanoidArm.values())for(float t:times)emit(p,side,t);
 }
}
