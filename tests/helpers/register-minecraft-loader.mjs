/** Preload for retained tests with static imports across the Minecraft boundary. */
import {createFixture} from './minecraft-fixture.mjs';
export const defaultFixture = createFixture();
globalThis[Symbol.for('grilling.test.minecraft.fixtures')].set('default', defaultFixture);
