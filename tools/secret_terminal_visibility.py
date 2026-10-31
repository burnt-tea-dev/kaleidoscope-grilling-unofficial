from eating_owner_properties import document
"""Bridge a local terminal use-gate fall until its owned server phase clears."""
OWNED = ('kaleidoscope_grilling:secret_skewer',
         'kaleidoscope_grilling:secret_skewer_java_three_alt')
PREFIX = 'v.kg_secret_terminal_'
OLD_MASK = ' && v.kg_secret_terminal_wait == 0'
MASK = ' && (v.kg_secret_terminal_wait ?? 0) == 0'
STAGE = 'v.kg_bite_stage = (v.kg_secret_terminal_wait ?? 0) == 1 ? 3 : v.kg_bite_stage;'


def retained_read(name):
    # initialize and pre_animation may not expose the same variable store.
    # Explicit fallback is required even in a non-owning-hand ternary branch.
    return '(' + name + ' ?? 0)'


def apply(description):
    identifier = description['identifier']
    if identifier not in OWNED:
        return description
    scripts = description['scripts']
    identity_prefix = PREFIX + ('alt_' if identifier.endswith('_java_three_alt') else 'regular_')
    values = ['v.kg_secret_ingredient_' + str(i) for i in range(3)] + ['v.kg_secret_piece_index']
    states = {hand: {
        'seen': identity_prefix + 'seen_' + hand,
        'elapsed': identity_prefix + 'elapsed_' + hand,
        'snapshots': [identity_prefix + 'snapshot_' + str(i) + '_' + hand for i in range(4)],
    } for hand in ('main', 'off')}
    scripts['initialize'] = [row for row in scripts.get('initialize', [])
                             if not row.startswith(PREFIX)]
    scripts['initialize'] += [PREFIX + 'seen = 0;', PREFIX + 'wait = 0;']
    for hand, state in states.items():
        selected = "c.item_slot == '" + hand + "_hand'"
        for name in [state['seen'], state['elapsed'], *state['snapshots']]:
            scripts['initialize'].append(name + ' = ' + selected + ' ? 0 : ' + retained_read(name) + ';')
    rows = [row for row in scripts['pre_animation']
            if not row.startswith(PREFIX) and not (row.startswith('v.kg_bite_stage = ') and 'v.kg_secret_terminal_wait' in row)]
    owner = next(i for i, row in enumerate(rows)
                 if row.startswith('v.kg_secret_owner_occupied = '))
    statement = rows[owner]
    for suffix in (MASK, OLD_MASK):
        if statement.endswith(suffix + ';'):
            statement = statement[:-len(suffix + ';')] + ';'
    rows[owner] = statement[:-1] + MASK + ';'
    identity = "(c.item_slot == 'off_hand' ? c.owning_entity->q.is_item_name_any('slot.weapon.offhand','" + identifier + "') : c.owning_entity->q.is_item_name_any('slot.weapon.mainhand','" + identifier + "'))"
    hand = "((c.item_slot == 'main_hand' && q.property('kaleidoscope_grilling:eat_hand') == 1) || (c.item_slot == 'off_hand' && q.property('kaleidoscope_grilling:eat_hand') == 2))"
    profile = '4' if identifier.endswith('_java_three_alt') else '3'
    phase = "(c.is_first_person == 1 && " + identity + ' && ' + hand + " && q.property('kaleidoscope_grilling:eat_profile') == " + profile + " && q.property('kaleidoscope_grilling:eat_native_ticks') > 0)"
    present = '(' + ' || '.join(value + ' > 0' for value in values[:3]) + ')'
    authoritative_elapsed = "q.property('kaleidoscope_grilling:eat_elapsed_ticks')"
    # Exact source third-bite checkpoints: ceil(3.54167*20) / 3.5*20.
    # A fresh server session with a still-stale local terminal clock must not
    # acquire terminal ownership again before its own third bite.
    terminal_tick = '70' if profile == '4' else '71'
    authoritative_terminal = '(' + authoritative_elapsed + ' >= ' + terminal_tick + ')'
    terminal = []
    # Only the current owning hand updates its retained state. Distinct form
    # prefixes prevent a regular/ALT attachable from changing the other's state
    # even if the engine supplies a shared variable store.
    for hand, state in states.items():
        selected = "c.item_slot == '" + hand + "_hand'"
        unchanged = '(' + ' && '.join(a + ' == ' + retained_read(b) for a, b in zip(values, state['snapshots'])) + ')'
        old_terminal = '(' + phase + ' && ' + present + ' && ' + unchanged + ' && ' + retained_read(state['seen']) + ' > 0 && ' + authoritative_terminal + ' && ' + authoritative_elapsed + ' >= ' + retained_read(state['elapsed']) + ')'
        # A local countdown restart is not an authoritative new serving. Keep
        # terminal ownership until its server elapsed time resets or another
        # existing ownership/snapshot boundary invalidates the old session.
        reset = '(' + retained_read(state['seen']) + ' > 0 && ' + authoritative_elapsed + ' < ' + retained_read(state['elapsed']) + ')'
        # State 2 retains a terminal hide across a local use restart until the
        # owning server phase resets; offhand has no main-hand countdown edge.
        update = '(q.is_using_item && ' + phase + ' && v.kg_bite_stage >= 3 && ' + authoritative_terminal + ' && ' + reset + ' == 0) ? (' + present + ' && ' + unchanged + ' && ' + retained_read(state['seen']) + ' == 2 ? 2 : 1) : (' + old_terminal + ' ? 2 : 0)'
        terminal.append(state['seen'] + ' = ' + selected + ' ? (' + update + ') : ' + retained_read(state['seen']) + ';')
    terminal += [
        PREFIX + "seen = c.item_slot == 'off_hand' ? " + retained_read(states['off']['seen']) + ' : ' + retained_read(states['main']['seen']) + ';',
        PREFIX + 'wait = ' + phase + ' && (q.is_using_item == 0 || v.kg_bite_stage < 3 || ' + retained_read(PREFIX + 'seen') + ' == 2) && ' + retained_read(PREFIX + 'seen') + ' > 0;',
        STAGE,
    ]
    for hand, state in states.items():
        selected = "c.item_slot == '" + hand + "_hand'"
        terminal += [saved + ' = ' + selected + ' ? ' + value + ' : ' + retained_read(saved) + ';'
                     for saved, value in zip(state['snapshots'], values)]
        terminal.append(state['elapsed'] + ' = (' + selected + ' && ' + phase + ' && ' + retained_read(PREFIX + 'wait') + ' == 0) ? ' + authoritative_elapsed + ' : ' + retained_read(state['elapsed']) + ';')
    rows[owner:owner] = terminal
    scripts['pre_animation'] = document(rows)
    return description


def augment(output):
    for path, document in output.items():
        if path.parent.name == 'attachables':
            apply(document['minecraft:attachable']['description'])
    return output
