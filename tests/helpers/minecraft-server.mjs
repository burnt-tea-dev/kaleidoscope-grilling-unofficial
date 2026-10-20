/** Native ESM replacement for the external API, never for a production module. */
const id = new URL(import.meta.url).searchParams.get('fixture');
const api = globalThis[Symbol.for('grilling.test.minecraft.fixtures')]?.get(id)?.server;
if (!api) throw new Error(`Unknown Minecraft test fixture: ${id}`);
export const {
  world, system, ItemStack, BlockPermutation, EquipmentSlot, GameMode,
  ItemComponentTypes, EntityComponentTypes, EnchantmentType, MolangVariableMap,
  CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus,
  Direction, ItemLockMode, ItemTypes, BlockTypes,
} = api;
