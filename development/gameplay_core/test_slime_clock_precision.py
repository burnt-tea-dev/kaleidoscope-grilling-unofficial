"""Proves arithmetic limits, not native Molang query units or persistence."""
import math
import struct
import unittest

def f32(x):
    return struct.unpack('f', struct.pack('f', x))[0]

def direct_molang_frame(tick):
    return math.floor(f32(f32(tick) / 4)) % 5

class SlimeClockPrecision(unittest.TestCase):
    def test_direct_level_timestamp_loses_boundaries(self):
        self.assertEqual((16777219 // 4) % 5, 4)
        self.assertEqual(direct_molang_frame(16777219), 0)
        self.assertEqual((67108869 // 4) % 5, 2)
        self.assertEqual(direct_molang_frame(67108869), 3)
        for power in (24, 26, 28, 32, 40):
            self.assertTrue(any(direct_molang_frame(2 ** power + d) != ((2 ** power + d) // 4) % 5 for d in range(40)))

    def test_reduced_frame_markers_survive_float32(self):
        for marker in range(215, 220):
            self.assertEqual(f32(marker) - 215, marker - 215)
        for power in (24, 26, 28, 32, 40, 52):
            for d in range(40):
                tick = 2 ** power + d
                self.assertEqual(math.floor(float(tick) / 4) % 5, (tick // 4) % 5)

if __name__ == '__main__':
    unittest.main()
