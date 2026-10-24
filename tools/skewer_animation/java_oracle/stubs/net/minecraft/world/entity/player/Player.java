package net.minecraft.world.entity.player;
import net.minecraft.world.item.ItemStack;
public class Player { private final ItemStack item; private final int remaining; public Player(int d,int r){item=new ItemStack(d);remaining=r;} public ItemStack getUseItem(){return item;} public int getUseItemRemainingTicks(){return remaining;} }
