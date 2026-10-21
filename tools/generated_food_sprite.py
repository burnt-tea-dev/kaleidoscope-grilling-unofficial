"""Java 1.20.1 generated-item side spans on verified referenced food sprites.

Only derived span facts are committed. External vanilla/Cookery artwork remains
in its original resource pack. Geometry selection shares the raw-last texture
index and adds no render pass, animation channel, or runtime player property.
"""
from copy import deepcopy

DIRECTIONS = (('up', 0, -1), ('down', 0, 1), ('left', -1, 0), ('right', 1, 0))
PIECE_BINDING = "q.item_slot_to_bone_name(context.item_slot == 'main_hand' ? 'off_hand' : 'main_hand')"


def spans_from_alpha(rows):
    """Pinned ItemModelGenerator: merge every exposed direction/anchor span.

    Transparency is alpha==0, not an invented cutoff. The Java generator merges
    min/max even across disjoint exposed runs on one anchor; side texture alpha
    preserves any resulting gaps. Input can contain the unique animation frames.
    """
    frames = rows if rows and isinstance(rows[0][0], (list, tuple)) else [rows]
    height, width = len(frames[0]), len(frames[0][0])
    assert all(len(frame) == height and all(len(row) == width for row in frame) for frame in frames)
    spans = {}
    for frame in frames:
        for y in range(height):
            for x in range(width):
                if frame[y][x] == 0:
                    continue
                for direction, dx, dy in DIRECTIONS:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < width and 0 <= ny < height and frame[ny][nx] != 0:
                        continue
                    horizontal = direction in ('up', 'down')
                    anchor, value = (y, x) if horizontal else (x, y)
                    key = (direction, anchor)
                    if key not in spans:
                        spans[key] = [value, value]
                    else:
                        spans[key][0] = min(spans[key][0], value)
                        spans[key][1] = max(spans[key][1], value)
    return [[direction, anchor, first, last] for (direction, anchor), (first, last) in spans.items()]


def span_cubes(spans, width, height):
    """Align source spans to the actual unchanged Bedrock main-face UV map.

    The established north/south UVs map image U to Bedrock X=u-8, V to Y=40-v.
    The Java element converter instead reflects X and is not the right mapping
    for these already-authored Bedrock front/back faces. Side V increases down,
    including east/west; up/down UV endpoints are reversed by Bedrock's codec.
    Side UVs use the boundary's actual pixel strip and virtual 16×16 UV units,
    including on higher-resolution sprites. No rectangle-background walls.
    """
    sx, sy = 16 / width, 16 / height
    result = []
    for direction, anchor, first, last in spans:
        if direction in ('up', 'down'):
            boundary = anchor + (direction == 'down')
            origin = [first * sx - 8, 40 - boundary * sy, -0.5]
            size = [(last + 1 - first) * sx, 0, 1]
            uv = [first * sx, anchor * sy]
            uv_size = [(last + 1 - first) * sx, sy]
            face = direction
        else:
            boundary = anchor + (direction == 'right')
            origin = [boundary * sx - 8, 40 - (last + 1) * sy, -0.5]
            size = [0, (last + 1 - first) * sy, 1]
            uv = [anchor * sx, first * sy]
            uv_size = [sx, (last + 1 - first) * sy]
            face = 'east' if direction == 'left' else 'west'
        result.append({'origin': origin, 'size': size, 'uv': {face: {'uv': uv, 'uv_size': uv_size}}})
    return result


def main_faces():
    # Preserve the original full NONE footprint, center and front/back UVs.
    # A volume with only north/south faces creates no opaque bounding-box side.
    return {'origin': [-8, 24, -0.5], 'size': [16, 16, 1], 'uv': {
        'north': {'uv': [0, 0], 'uv_size': [16, 16]},
        'south': {'uv': [16, 0], 'uv_size': [-16, 16]}}}


def piece_geometry(identifier, cubes):
    return {'description': {'identifier': identifier, 'texture_width': 16, 'texture_height': 16,
                            'visible_bounds_width': 4, 'visible_bounds_height': 4,
                            'visible_bounds_offset': [0, 1.5, 0]},
            'bones': [{'name': 'grip', 'pivot': [0, 24, 0], 'binding': PIECE_BINDING},
                      {'name': 'dual_piece', 'parent': 'grip', 'pivot': [0, 24, 0], 'cubes': deepcopy(cubes)}]}
