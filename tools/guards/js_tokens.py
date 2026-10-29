"""Small JS lexer for guard inputs, not a JavaScript evaluator.

Comments are discarded; quoted strings stay opaque. This intentionally does
not claim to prove control flow or migrations. Computed persisted keys still
need the literal registry required by SAVE-COMPAT.
"""
import re

TOKEN = re.compile(r'''(?P<comment>//[^\n]*|/\*[\s\S]*?\*/)|(?P<string>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(?P<name>[$\w]+)|(?P<other>[^\s])''')

def tokens(text):
    return [(m.lastgroup, m.group()) for m in TOKEN.finditer(text) if m.lastgroup != 'comment']

def code(text):
    """Normalize member-access whitespace, while excluding comments/strings."""
    ts = tokens(text)
    out, i = [], 0
    while i < len(ts):
        if (i+2 < len(ts) and ts[i][1] == '[' and ts[i+2][1] == ']'
                and ts[i+1][0] == 'string' and re.fullmatch(r'[$A-Za-z_][\w$]*', ts[i+1][1][1:-1])):
            out.append('.' + ts[i+1][1][1:-1]); i += 3; continue
        kind, value = ts[i]
        if value == '?' and i+1 < len(ts) and ts[i+1][1] == '.':
            i += 1; continue
        out.append(value if kind != 'string' else '""'); i += 1
    return ''.join(out)


def literal(token):
    kind, value = token
    if kind != 'string' or '${' in value:
        return None
    # Keys must be literal, with no escapes hiding changes from review.
    if '\\' in value:
        return None
    return value[1:-1]

def persisted_literals(text, include_bare_registry_keys=False):
    ts = tokens(text)
    values = {}
    expressions = {}
    # Include comma-separated declarations and aliases, without guessing from
    # the spelling or capitalization of a variable's name.
    for i in range(len(ts)-2):
        if ts[i][0] != 'name' or ts[i+1][1] != '=':
            continue
        value = ts[i+2]
        following = ts[i+3][1] if i+3 < len(ts) else ";"
        if i+5 < len(ts) and ts[i+3][1] == '=' and ts[i+4][1] == '>' and literal(ts[i+5]) is not None:
            expressions.setdefault(ts[i][1], []).append([ts[i+5]])
        if value[0] in ("string", "name") and following in (";", ",", ")", "]", "}", "+", "("):
            expressions.setdefault(ts[i][1], []).append([value])
    for _ in range(len(expressions)+1):
        changed = False
        for name, exprs in expressions.items():
            new = set()
            for expr in exprs:
                for token in expr:
                    value = literal(token)
                    if value is not None: new.add(value)
                    elif token[0] == 'name': new.update(values.get(token[1], set()))
            if not new <= values.get(name, set()):
                values.setdefault(name, set()).update(new); changed = True
        if not changed: break
    found = set()
    # Registry declarations retain the existing conservative KEY/PREFIX
    # contract; any namespace is supported, including senluo metadata.
    for name, strings in values.items():
        if re.search(r'KEY|PREFIX|PROPERTY|OWNER|NAMESPACE', name):
            found.update(s for s in strings if re.match(r'^[\w.-]+:', s) or include_bare_registry_keys)
    # Recognize direct calls and the public item metadata helpers. Resolve
    # locally aliased variables regardless of their name.
    signatures = {'getDynamicProperty': 0, 'setDynamicProperty': 0,
                  'getItemProperty': 1, 'setItemProperty': 1}
    # Infer local wrappers, including a key passed as an arbitrary parameter.
    functions = []
    for i in range(len(ts)-3):
        if ts[i][1] != 'function' or ts[i+2][1] != '(': continue
        j = i+3
        params = []
        while j < len(ts) and ts[j][1] != ')':
            if ts[j][0] == 'name': params.append(ts[j][1])
            j += 1
        if j+1 >= len(ts) or ts[j+1][1] != '{': continue
        end, depth = j+2, 1
        while end < len(ts) and depth:
            if ts[end][1] == '{': depth += 1
            elif ts[end][1] == '}': depth -= 1
            end += 1
        functions.append((ts[i+1][1], params, ts[j+2:end-1]))
    for _ in range(len(functions)+1):
        changed = False
        for name, params, body in functions:
            if name in signatures: continue
            for j in range(len(body)-2):
                if body[j][1] not in signatures or body[j+1][1] != '(': continue
                args, current, depth = [], [], 0
                for token in body[j+2:]:
                    value = token[1]
                    if value == ')' and depth == 0:
                        args.append(current); break
                    if value == ',' and depth == 0:
                        args.append(current); current = []; continue
                    current.append(token)
                    if value in ['(', '[', '{']: depth += 1
                    elif value in [')', ']', '}']: depth -= 1
                key_index = signatures[body[j][1]]
                if key_index < len(args) and len(args[key_index]) == 1:
                    parameter = args[key_index][0][1]
                    if parameter in params:
                        signatures[name] = params.index(parameter); changed = True; break
        if not changed: break
    for i in range(len(ts)-1):
        name = ts[i][1]
        if name not in signatures or ts[i+1][1] != '(':
            continue
        args, current, depth = [], [], 0
        for token in ts[i+2:]:
            value = token[1]
            if value == ')' and depth == 0:
                args.append(current); break
            if value == ',' and depth == 0:
                args.append(current); current = []; continue
            current.append(token)
            if value in ['(', '[', '{']: depth += 1
            elif value in [')', ']', '}']: depth -= 1
        index = signatures[name]
        if index >= len(args): continue
        expression = args[index]
        if not expression: continue
        token = expression[0]
        value = literal(token)
        if value is not None: found.add(value)
        elif token[0] == 'name' and (len(expression) == 1 or expression[1][1] in ('+', '(')):
            found.update(values.get(token[1], set()))
    # Namespaced literal prefixes in key-building functions remain visible
    # even when passed through local wrappers.
    for a, b in zip(ts, ts[1:]):
        value = literal(a)
        if value and re.match(r'^kaleidoscope_grilling:[a-z0-9_./:-]+$', value) and b[1] == '+': found.add(value)
    return found
