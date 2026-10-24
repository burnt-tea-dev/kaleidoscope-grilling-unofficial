package net.minecraft.world.entity;
public enum HumanoidArm { LEFT, RIGHT; public HumanoidArm getOpposite(){return this==RIGHT?LEFT:RIGHT;} }
