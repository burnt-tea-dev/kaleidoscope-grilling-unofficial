"""Pinned Java SkewerColorProvider palettes for threaded secret-food meshes.

The source is the pinned Forge 1.20.1 SkewerColorProvider.java reviewed for this
repair. Sampling operates on the supplied particle sprite, not an item icon
chosen here. Source resolution, sprite animation-frame selection and any known
item tint belong to the caller.

Public colors are 24-bit RGB integers. Palette cells are x + 4*z; source image Y
is inverted into model Z. Atlas rows follow Java's numeric face order 0..5 and
columns are cells 0..15. Each atlas texel is opaque, with no full-food icon.

Java float expressions are evaluated as IEEE-754 binary32 at every arithmetic
step, and Math.round(float) uses ties toward positive infinity. Lab distances
use double precision. Cooked-snapshot only selects stage 4's snapshot glaze;
the caller is responsible for selecting stage 4 for a cooked stack at rest.
"""

from __future__ import annotations

import math
import struct
from dataclasses import dataclass
from functools import lru_cache
from typing import Sequence

from PIL import Image

GRID_SIZE = 4
CELL_COUNT = GRID_SIZE * GRID_SIZE
FACE_COUNT = 6
FALLBACK = 0xB86B45
PINNED_PROVIDER_SHA256 = "8c58e70f7f581ac548c99667bea315e594407b4b35a5a9cc29c0bbeda435a4cb"
_FACE_FACTORS = (1.05, 0.75, 0.80, 0.90, 0.88, 0.84)


def _f32(value: float) -> float:
    return struct.unpack("!f", struct.pack("!f", value))[0]


def _add(a: float, b: float) -> float:
    return _f32(a + b)


def _sub(a: float, b: float) -> float:
    return _f32(a - b)


def _mul(a: float, b: float) -> float:
    return _f32(a * b)


def _round(value: float) -> int:
    return math.floor(value + 0.5)


def _channels(rgb: int) -> tuple[int, int, int]:
    return (rgb >> 16 & 0xFF, rgb >> 8 & 0xFF, rgb & 0xFF)


def _rgb(channels: Sequence[int]) -> int:
    red, green, blue = channels
    return red << 16 | green << 8 | blue


def _clamp_channel(value: float) -> int:
    return min(255, max(0, _round(value)))


def _luminance(rgb: int) -> int:
    red, green, blue = _channels(rgb)
    return _round(_add(_add(_mul(red, _f32(0.2126)),
                           _mul(green, _f32(0.7152))),
                       _mul(blue, _f32(0.0722))))


def _average(colors: Sequence[int]) -> int:
    size = max(1, len(colors))
    return _rgb([sum(_channels(color)[i] for color in colors) // size
                 for i in range(3)])


def _collect(image: Image.Image, min_x: int, max_x: int,
             min_y: int, max_y: int, dark_cutoff: int) -> list[int]:
    colors = []
    pixels = image.load()
    for y in range(min_y, min(max_y, image.height)):
        for x in range(min_x, min(max_x, image.width)):
            red, green, blue, alpha = pixels[x, y]
            if alpha < 48:
                continue
            rgb = red << 16 | green << 8 | blue
            if _luminance(rgb) >= dark_cutoff:
                colors.append(rgb)
    return colors


def _fill_transparent_cells(colors: list[int | None], fallback: int) -> None:
    # Match Java's in-place ascending pass: an earlier filled cell can become
    # the nearest candidate, and ties retain the lowest candidate index.
    for index, color in enumerate(colors):
        if color is not None:
            continue
        x, z = index % GRID_SIZE, index // GRID_SIZE
        nearest = -1
        nearest_distance = CELL_COUNT
        for candidate, candidate_color in enumerate(colors):
            if candidate_color is None:
                continue
            distance = abs(x - candidate % GRID_SIZE) + abs(z - candidate // GRID_SIZE)
            if distance < nearest_distance:
                nearest, nearest_distance = candidate, distance
        colors[index] = fallback if nearest < 0 else colors[nearest]


def _linear(value: float) -> float:
    return value / 12.92 if value <= 0.04045 else math.pow((value + 0.055) / 1.055, 2.4)


def _pivot_lab(value: float) -> float:
    return math.cbrt(value) if value > 0.008856 else 7.787 * value + 16.0 / 116.0


@lru_cache(maxsize=4096)
def _to_lab(rgb: int) -> tuple[float, float, float]:
    red, green, blue = (_linear(channel / 255.0) for channel in _channels(rgb))
    x = _pivot_lab((red * 0.4124564 + green * 0.3575761 + blue * 0.1804375) / 0.95047)
    y = _pivot_lab(red * 0.2126729 + green * 0.7151522 + blue * 0.0721750)
    z = _pivot_lab((red * 0.0193339 + green * 0.1191920 + blue * 0.9503041) / 1.08883)
    return 116 * y - 16, 500 * (x - y), 200 * (y - z)


def _lab_distance_squared(first: int, second: int) -> float:
    a, b = _to_lab(first), _to_lab(second)
    dl, da, db = a[0] - b[0], a[1] - b[1], a[2] - b[2]
    return dl * dl + da * da + db * db


@dataclass
class _ColorCluster:
    count: int
    red: int
    green: int
    blue: int

    @classmethod
    def from_color(cls, color: int) -> _ColorCluster:
        return cls(1, *_channels(color))

    def merge(self, other: _ColorCluster) -> None:
        self.count += other.count
        self.red += other.red
        self.green += other.green
        self.blue += other.blue

    def average(self) -> int:
        return _rgb((self.red // self.count, self.green // self.count, self.blue // self.count))


def _quantize(colors: Sequence[int], max_colors: int) -> list[int]:
    clusters = [_ColorCluster.from_color(color) for color in colors]
    while len(clusters) > max_colors:
        first, second, nearest = 0, 1, math.inf
        for i in range(len(clusters)):
            for j in range(i + 1, len(clusters)):
                distance = _lab_distance_squared(clusters[i].average(), clusters[j].average())
                if distance < nearest:
                    nearest, first, second = distance, i, j
        clusters[first].merge(clusters.pop(second))
    result = []
    for color in colors:
        nearest_color = clusters[0].average()
        nearest = _lab_distance_squared(color, nearest_color)
        for cluster in clusters[1:]:
            candidate = cluster.average()
            distance = _lab_distance_squared(color, candidate)
            if distance < nearest:
                nearest, nearest_color = distance, candidate
        result.append(nearest_color)
    return result


def _java_integer_map_entries(values: Sequence[int]) -> list[tuple[int, int]]:
    # Default Java HashMap has 16 buckets for these <=4 neighbor keys. Integer
    # hash spreading and insertion order within a bucket decide a 2-vs-2 tie.
    counts: dict[int, int] = {}
    for color in values:
        counts[color] = counts.get(color, 0) + 1
    return sorted(counts.items(), key=lambda entry: (entry[0] ^ (entry[0] >> 16)) & 15)


def _clean_isolated_cells(colors: list[int]) -> None:
    original = colors.copy()
    frequencies: dict[int, int] = {}
    for color in original:
        frequencies[color] = frequencies.get(color, 0) + 1
    for index, color in enumerate(original):
        if frequencies[color] > 1:
            continue
        x, z = index % GRID_SIZE, index // GRID_SIZE
        neighbors = []
        if x > 0:
            neighbors.append(original[index - 1])
        if x + 1 < GRID_SIZE:
            neighbors.append(original[index + 1])
        if z > 0:
            neighbors.append(original[index - GRID_SIZE])
        if z + 1 < GRID_SIZE:
            neighbors.append(original[index + GRID_SIZE])
        majority, majority_count = color, 0
        for candidate, count in _java_integer_map_entries(neighbors):
            if count > majority_count:
                majority, majority_count = candidate, count
        if majority_count >= 2 and _lab_distance_squared(color, majority) > 30 * 30:
            colors[index] = majority


def _multiply(first: int, second: int) -> int:
    return _rgb([a * b // 255 for a, b in zip(_channels(first), _channels(second))])


def sample_grid(image: Image.Image, item_tint: int = -1) -> list[int]:
    """Sample a particle sprite into 16 RGB ints using the pinned Java recipe.

    Alpha 48 is included; pixels below 48 are ignored. The center half is used
    unless it is empty. Pass a 24-bit tint, or a negative Java int for no tint.
    Unsigned 32-bit values are interpreted as signed Java ints as well.
    """
    image = image.convert("RGBA")
    width, height = image.size
    if width < 1 or height < 1:
        raise ValueError("particle sprite must be non-empty")
    min_x, min_y = width // 4, height // 4
    max_x, max_y = max(min_x + 1, width * 3 // 4), max(min_y + 1, height * 3 // 4)
    center_colors = _collect(image, min_x, max_x, min_y, max_y, 0)
    if not center_colors:
        min_x, min_y, max_x, max_y = 0, 0, width, height
        center_colors = _collect(image, min_x, max_x, min_y, max_y, 0)
    fallback = _average(center_colors) if center_colors else FALLBACK
    luminances = sorted(_luminance(color) for color in center_colors)
    median_luminance = luminances[len(luminances) // 2] if luminances else _luminance(FALLBACK)
    dark_cutoff = min(36, max(5, _round(_mul(median_luminance, _f32(0.24)))))
    sampled: list[int | None] = [None] * CELL_COUNT
    for grid_z in range(GRID_SIZE):
        source_y = GRID_SIZE - 1 - grid_z
        from_y = min_y + (max_y - min_y) * source_y // GRID_SIZE
        to_y = max(from_y + 1, min_y + (max_y - min_y) * (source_y + 1) // GRID_SIZE)
        for grid_x in range(GRID_SIZE):
            from_x = min_x + (max_x - min_x) * grid_x // GRID_SIZE
            to_x = max(from_x + 1, min_x + (max_x - min_x) * (grid_x + 1) // GRID_SIZE)
            block = _collect(image, from_x, to_x, from_y, to_y, dark_cutoff)
            if not block:
                block = _collect(image, from_x, to_x, from_y, to_y, 0)
            if block:
                sampled[grid_z * GRID_SIZE + grid_x] = _average(block)
    _fill_transparent_cells(sampled, fallback)
    signed_tint = item_tint & 0xFFFFFFFF
    if signed_tint >= 0x80000000:
        signed_tint -= 0x100000000
    colors = [int(color) if signed_tint < 0 else _multiply(int(color), signed_tint)
              for color in sampled]
    result = _quantize(colors, 8)
    _clean_isolated_cells(result)
    return result


def _shade(rgb: int, factor: float) -> int:
    return _rgb([_clamp_channel(_mul(channel, factor)) for channel in _channels(rgb)])


def _shade_for_face(color: int, face: int) -> int:
    strength = min(_f32(1.0), max(_f32(0.35), _f32(_luminance(color) / _f32(90.0))))
    factor = _mul(_add(_f32(1.0), _mul(_sub(_f32(_FACE_FACTORS[face]), _f32(1.0)), strength)),
                  _f32(1.06))
    return _shade(color, factor)


def _blend(rgb: int, target: int, amount: float, brightness: float) -> int:
    amount, brightness = _f32(amount), _f32(brightness)
    return _rgb([_clamp_channel(_mul(_add(_mul(a, _sub(_f32(1.0), amount)),
                                         _mul(b, amount)), brightness))
                 for a, b in zip(_channels(rgb), _channels(target))])


def _stage_color(rgb: int, cell: int, stage: int, cooked_snapshot: bool) -> int:
    if stage == 0:
        return rgb
    if stage == 1:
        return _blend(rgb, 0xFFD06A, 0.16, 1.08)
    x, z = cell % GRID_SIZE, cell // GRID_SIZE
    edge = x in (0, GRID_SIZE - 1) or z in (0, GRID_SIZE - 1)
    if stage == 2:
        return _blend(rgb, 0xB96A32, 0.27 if edge else 0.18, 0.96 if edge else 1.0)
    if stage == 3:
        return _blend(rgb, 0x9D4825, 0.40 if edge else 0.28, 0.88 if edge else 0.94)
    if stage >= 5:
        return _blend(rgb, 0x17110E, 0.88 if edge else 0.76, 0.42 if edge else 0.52)
    if cooked_snapshot:
        glazed = _blend(rgb, 0xC84F3B, 0.04 if edge else 0.08, 1.02)
        return _blend(glazed, 0x713A22, 0.14 if edge else 0.06, 0.97 if edge else 1.0)
    glazed = _blend(rgb, 0xB94A35, 0.10 if edge else 0.16, 1.0)
    return _blend(glazed, 0x713A22, 0.34 if edge else 0.18, 0.91 if edge else 0.98)


def _validate_palette(palette: Sequence[int]) -> None:
    if len(palette) != CELL_COUNT or any(not isinstance(rgb, int) or not 0 <= rgb <= 0xFFFFFF
                                          for rgb in palette):
        raise ValueError("palette must contain exactly 16 24-bit RGB ints")


def color_at(palette: Sequence[int], face: int, cell: int, stage: int,
             cooked_snapshot: bool = False) -> int:
    """Return one 24-bit RGB int, applying face shading before stage styling."""
    _validate_palette(palette)
    if not isinstance(face, int) or not 0 <= face < FACE_COUNT:
        raise ValueError("face must be an integer in 0..5")
    if not isinstance(cell, int) or not 0 <= cell < CELL_COUNT:
        raise ValueError("cell must be an integer in 0..15")
    if not isinstance(stage, int) or not 0 <= stage <= 5:
        raise ValueError("stage must be an integer in 0..5")
    return _stage_color(_shade_for_face(palette[cell], face), cell, stage, cooked_snapshot)


def render_atlas(palette: Sequence[int], stage: int,
                 cooked_snapshot: bool = False) -> Image.Image:
    """Return an opaque RGBA atlas: x=cell, y=Java numeric face, size 16x6."""
    atlas = Image.new("RGBA", (CELL_COUNT, FACE_COUNT))
    atlas.putdata([(*_channels(color_at(palette, face, cell, stage, cooked_snapshot)), 255)
                   for face in range(FACE_COUNT) for cell in range(CELL_COUNT)])
    return atlas
