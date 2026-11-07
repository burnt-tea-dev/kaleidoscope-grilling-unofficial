// The original network-food fixture imports full main. Start it exactly once.
import './ordinary_network_food_probe.js';
import {announceOrdinaryDamageTrace} from './ordinary_damage_trace.js';
announceOrdinaryDamageTrace();
