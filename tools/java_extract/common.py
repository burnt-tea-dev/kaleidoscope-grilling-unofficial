"""Small, non-executing readers for the pinned Java data declarations."""
from __future__ import annotations
import ast
import hashlib
import operator
import re
from pathlib import Path

COMMIT = '9a1acdab27698457bec16c9362678e574895a28c'
REPOSITORY = 'https://github.com/breezeth-CN/KaleidoscopeGrilling'
LOADERS = ('forge-1.20.1', 'neoforge-1.21.1')
JAVA = 'src/main/java/cn/breezeth/kaleidoscope_grilling/'


def strip_comments(text):
    pattern = r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|//[^\n]*|/\*[\s\S]*?\*/'
    return re.sub(pattern, lambda m: ''.join('\n' if c == '\n' else ' ' for c in m[0]) if m[0].startswith(('/', '/*')) else m[0], text)


def balanced(text, start, opening='(', closing=')'):
    if text[start] != opening:
        raise ValueError(f'Expected {opening!r} at {start}')
    depth, quote, escaped = 0, None, False
    for i in range(start, len(text)):
        c = text[i]
        if quote:
            if escaped: escaped = False
            elif c == '\\': escaped = True
            elif c == quote: quote = None
            continue
        if c in ('"', "'"): quote = c
        elif c == opening: depth += 1
        elif c == closing:
            depth -= 1
            if depth == 0: return text[start + 1:i], i + 1
    raise ValueError(f'Unclosed {opening!r} at {start}')


def split_args(text):
    result, start, stack, quote, escaped = [], 0, [], None, False
    for i, c in enumerate(text):
        if quote:
            if escaped: escaped = False
            elif c == '\\': escaped = True
            elif c == quote: quote = None
            continue
        if c in ('"', "'"): quote = c
        elif c in '([{': stack.append(c)
        elif c in ')]}':
            if not stack: raise ValueError('Unbalanced Java arguments')
            stack.pop()
        elif c == ',' and not stack:
            result.append(text[start:i].strip()); start = i + 1
    if text[start:].strip(): result.append(text[start:].strip())
    return result


def mask_strings(text):
    return re.sub(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'',
                  lambda match: ''.join('\n' if char == '\n' else ' ' for char in match[0]), text)


def calls(text, name):
    text = strip_comments(text)
    searchable = mask_strings(text)
    for match in re.finditer(r'(?<![\w$])' + re.escape(name) + r'\s*\(', searchable):
        start = text.index('(', match.start())
        inside, _ = balanced(text, start)
        yield match.start(), split_args(inside)


_OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
        ast.Div: operator.truediv, ast.FloorDiv: operator.floordiv, ast.Mod: operator.mod,
        ast.LShift: operator.lshift, ast.RShift: operator.rshift, ast.BitOr: operator.or_,
        ast.BitAnd: operator.and_, ast.BitXor: operator.xor}


def number(expr):
    """Evaluate only Java literal arithmetic; never eval or execute upstream code.

    Floating decimal values remain their authored decimals, not a claim about
    IEEE-754 rounding. Java integral division truncates toward zero.
    """
    expr = expr.strip().replace('_', '')
    integer_bits = 64 if re.search(r'(?<=[0-9a-fA-F])[lL]\b', expr) else 32
    if re.search(r'\((?:int|long|float|double)\)', expr):
        raise ValueError('Java casts require type-aware evaluation; retain the source expression')
    def normalize(match):
        token = match[0]
        if token.lower().startswith('0x'):
            wide = token[-1:] in ('l', 'L')
            value = int(token[:-1] if wide else token, 16)
            bits = 64 if wide else 32
            if value >= 1 << bits: raise ValueError('Oversized Java hexadecimal literal')
            if value >= 1 << (bits-1): value -= 1 << bits
            return str(value)
        suffix = token[-1:] if token[-1:] in 'fFdDlL' else ''
        value = token[:-1] if suffix else token
        if suffix in ('f', 'F', 'd', 'D') and '.' not in value and 'e' not in value.lower():
            value += '.0'
        return value
    expr = re.sub(r'(?<![\w.])(?:0[xX][0-9a-fA-F]+[lL]?|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[fFdDlL]?)(?![\w.])', normalize, expr)
    try: tree = ast.parse(expr, mode='eval')
    except SyntaxError as exc: raise ValueError(f'Not literal arithmetic: {expr}') from exc
    def read(node):
        if isinstance(node, ast.Expression): return read(node.body)
        if isinstance(node, ast.Constant) and type(node.value) in (int, float): return node.value
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub, ast.Invert)):
            return {ast.UAdd: operator.pos, ast.USub: operator.neg, ast.Invert: operator.invert}[type(node.op)](read(node.operand))
        if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
            left, right = read(node.left), read(node.right)
            if isinstance(node.op, ast.Div) and type(left) is int and type(right) is int:
                if not right: raise ValueError('Division by zero')
                result = abs(left) // abs(right) * (-1 if (left < 0) != (right < 0) else 1)
                if not -(1 << (integer_bits-1)) <= result < (1 << (integer_bits-1)):
                    raise ValueError('Overflowing Java division requires type-aware evaluation')
                return result
            if isinstance(node.op, ast.Mod):
                if not right: raise ValueError('Division by zero')
                import math
                if type(left) is int and type(right) is int:
                    quotient = abs(left) // abs(right) * (-1 if (left < 0) != (right < 0) else 1)
                    return left - quotient * right
                return math.fmod(left, right)
            if isinstance(node.op, (ast.LShift, ast.RShift)) and not 0 <= right < integer_bits:
                raise ValueError('Masked Java shift distances require type-aware evaluation')
            result = _OPS[type(node.op)](left, right)
            if type(result) is int and not -(1 << (integer_bits-1)) <= result < (1 << (integer_bits-1)):
                raise ValueError('Overflowing Java arithmetic requires type-aware evaluation')
            return result
        raise ValueError(f'Not literal arithmetic: {expr}')
    return read(tree)


def source_info(upstream: Path, path, line=None, method=None):
    path = str(path)
    result = {'path': path, 'url': f'{REPOSITORY}/blob/{COMMIT}/{path}',
              'sha256': hashlib.sha256((upstream / path).read_bytes()).hexdigest()}
    if line is not None: result['line'] = line; result['url'] += f'#L{line}'
    if method is not None: result['method'] = method
    return result


def envelope(method, **data):
    return {'source_commit': COMMIT, 'source_repository': REPOSITORY,
            'extraction_method': method, 'licenses': ['LICENSE-CODE (BSD-3-Clause)', 'LICENSE-ASSETS (CC-BY-NC-SA-4.0)'], **data}
