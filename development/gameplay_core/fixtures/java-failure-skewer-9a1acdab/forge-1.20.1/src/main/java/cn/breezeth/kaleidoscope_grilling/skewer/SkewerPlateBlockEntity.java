package cn.breezeth.kaleidoscope_grilling.skewer;

import cn.breezeth.kaleidoscope_grilling.registry.ModBlockEntities;

import java.util.List;
import net.minecraft.core.BlockPos;
import net.minecraft.core.NonNullList;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.network.Connection;
import net.minecraft.network.protocol.game.ClientboundBlockEntityDataPacket;
import net.minecraft.world.ContainerHelper;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;

public final class SkewerPlateBlockEntity extends BlockEntity {
  public static final int CAPACITY = 5;
  private NonNullList<ItemStack> skewers = NonNullList.withSize(CAPACITY, ItemStack.EMPTY);

  public SkewerPlateBlockEntity(BlockPos pos, BlockState state) {
    super(ModBlockEntities.SKEWER_PLATE.get(), pos, state);
  }

  public int size() {
    int count = 0;
    for (ItemStack stack : skewers) if (!stack.isEmpty()) count++;
    return count;
  }

  public boolean add(ItemStack source, boolean creative) {
    if (!SkewerPlateItem.isSkewer(source) || size() >= CAPACITY) return false;
    for (int slot = 0; slot < CAPACITY; slot++) {
      if (!skewers.get(slot).isEmpty()) continue;
      skewers.set(slot, source.copyWithCount(1));
      if (!creative) source.shrink(1);
      sync();
      return true;
    }
    return false;
  }

  public ItemStack removeLast() {
    for (int slot = CAPACITY - 1; slot >= 0; slot--) {
      if (skewers.get(slot).isEmpty()) continue;
      ItemStack result = skewers.get(slot);
      skewers.set(slot, ItemStack.EMPTY);
      compact();
      sync();
      return result;
    }
    return ItemStack.EMPTY;
  }

  public List<ItemStack> copySkewers() {
    return skewers.stream().filter(stack -> !stack.isEmpty()).map(ItemStack::copy).toList();
  }

  public void setSkewers(List<ItemStack> values) {
    skewers = NonNullList.withSize(CAPACITY, ItemStack.EMPTY);
    for (int i = 0; i < Math.min(CAPACITY, values.size()); i++)
      skewers.set(i, values.get(i).copyWithCount(1));
    sync();
  }

  private void compact() {
    NonNullList<ItemStack> compacted = NonNullList.withSize(CAPACITY, ItemStack.EMPTY);
    int target = 0;
    for (ItemStack stack : skewers) if (!stack.isEmpty()) compacted.set(target++, stack);
    skewers = compacted;
  }

  private void sync() {
    setChanged();
    if (level != null) level.sendBlockUpdated(worldPosition, getBlockState(), getBlockState(), 3);
  }

  @Override
  protected void saveAdditional(CompoundTag tag) {
    super.saveAdditional(tag);
    ContainerHelper.saveAllItems(tag, skewers);
  }

  @Override
  public void load(CompoundTag tag) {
    super.load(tag);
    skewers = NonNullList.withSize(CAPACITY, ItemStack.EMPTY);
    ContainerHelper.loadAllItems(tag, skewers);
    compact();
  }

  @Override
  public CompoundTag getUpdateTag() {
    CompoundTag tag = super.getUpdateTag();
    saveAdditional(tag);
    return tag;
  }

  @Override
  public ClientboundBlockEntityDataPacket getUpdatePacket() {
    return ClientboundBlockEntityDataPacket.create(this);
  }

  @Override
  public void onDataPacket(Connection connection, ClientboundBlockEntityDataPacket packet) {
    if (packet.getTag() != null) load(packet.getTag());
  }
}
