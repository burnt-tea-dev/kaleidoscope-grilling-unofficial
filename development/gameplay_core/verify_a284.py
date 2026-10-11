"""Eating-pose regression gate. Static evidence only; client acceptance remains open."""
import json, re
from verify_a283 import BP, RP, main as previous_gate


def eating_gate():
    script = (BP / 'scripts/main.js').read_text()
    version = tuple(json.loads((BP / 'manifest.json').read_text())['header']['version'])
    start = script.split('world.afterEvents.itemStartUse.subscribe', 1)[1].split('world.afterEvents.itemCompleteUse.subscribe', 1)[0]
    # Pending seasoning has its separate shake. Food may only supply the
    # third-person native rotation fallback; legacy translated limbs stay banned.
    food_start = start.split('if(!FOOD_DATA[id]&&id!==SECRET_ID)return;', 1)[1]
    if 'playAnimation' in food_start:
        if version >= (2, 8, 58):
            assert food_start.count('playAnimation') == 2
            if version >= (2, 8, 126):
                # Keep the normal Java fallback and the one exact reviewed route.
                dispatch = "playAnimation(((e.itemStack.typeId==='kaleidoscope_grilling:grilled_caterpillar_skewer'&&profile==='ONE'&&hand!=='off')?'animation.kg_probe_caterpillar.player.one.right':('animation.kg_java_eating.player.'+profile.toLowerCase()+'.'+(hand==='off'?'left':'right'))),{"
                assert food_start.count(dispatch) == 1
            else:
                assert "playAnimation('animation.kg_java_eating.player.'" in food_start
            assert 'supportsJavaEatingProjection(e.itemStack.typeId,profile)' in food_start
            projected = json.loads((RP / 'animations/java_eating_player.animation.json').read_text())['animations']
            dual=(RP/'render_controllers/java_eating_piece.render_controllers.json').exists()
            profiles=('TWO','THREE_ALT','FOUR','ONE','THREE') if dual else ('TWO','THREE_ALT','FOUR')
            assert set(projected)=={'animation.kg_java_eating.player.'+profile.lower()+'.'+hand for profile in profiles for hand in ('right','left')}
            for name, pose in projected.items():
                hand = name.rsplit('.', 1)[1]
                other = 'left' if hand == 'right' else 'right'
                assert pose.get('override_previous_animation') is True
                assert 'this' not in json.dumps(pose['bones'])
                assert pose['blend_weight'].startswith('variable.is_first_person && ')
                assert "q.property('kaleidoscope_grilling:eat_projection') == 1" in pose['blend_weight']
                if name.split('.')[-2] in ('one','three'):
                    assert set(pose['bones'])=={'rightarm','leftarm','rightitem','leftitem'}
                    assert "q.is_item_equipped('"+('off_hand' if hand=='right' else 'main_hand')+"') == 0" in pose['blend_weight']
                    for socket in ('rightitem','leftitem'):assert pose['bones'][socket]['scale']==[1,1,1] and pose['bones'][socket]['rotation']==[0,0,0]
                else:
                    assert set(pose['bones']) == {hand+'arm', hand+'item', other+'item'}
                    assert pose['bones'][other+'item'] == {'scale': 0}
        else:
            assert food_start.count('playAnimation') == 1
        assert "playAnimation('animation.kg_eating.player.native_'" in food_start
        poses = json.loads((RP / 'animations/eating_arms.animation.json').read_text())['animations']
        for hand in ('right', 'left'):
            pose = poses['animation.kg_eating.player.native_' + hand]
            assert not pose.get('override_previous_animation', False)
            assert '!variable.is_first_person' in pose['blend_weight']
            assert set(pose['bones']) == {hand + 'arm'}
            assert set(pose['bones'][hand + 'arm']) == {'rotation'}
    stop = script.split('world.afterEvents.itemStopUse.subscribe', 1)[1].split('world.beforeEvents.entityHurt.subscribe', 1)[0]
    assert 'playAnimation' not in stop
    tick = script.split('const active=ACTIVE_EATS.get(p.id);', 1)[1].split('writeFx(p,readFx(p))', 1)[0]
    assert 'playAnimation' not in tick
    assert 'advanceBites(p,active)' in tick and 'hungerSettle(' not in tick
    assert 'if(ACTIVE_EATS.get(id)!==a)return' in stop
    if version >= (2, 8, 54):
        # Java's 25-tick visual checkpoint has a one-tick RELEASE-only grace.
        # Older immutable candidates retain their original exact assertion.
        assert 'const MINIMUM_EAT_TICKS=25,RELEASE_CHECKPOINT_GRACE_TICKS=1;' in script
        assert 'const used=system.currentTick-a.start;' in stop
        assert 'used+RELEASE_CHECKPOINT_GRACE_TICKS>=MINIMUM_EAT_TICKS&&hungerSettle(e.source,a.id,a)' in stop
    else:
        assert 'used>=25&&hungerSettle(e.source,a.id,a)' in stop
    for file in (BP / 'scripts').rglob('*.js'):
        assert 'animation.kg_imm.player.eat_' not in file.read_text(), file
    data = (BP / 'scripts/data.js').read_text()
    required = set(json.loads(re.search(r'export const FOOD_DATA=Object.freeze\((.*)\);', data)[1]))
    required.add('kaleidoscope_grilling:secret_skewer')
    foods = set()
    for file in (BP / 'items').glob('*.json'):
        item = json.loads(file.read_text())['minecraft:item']
        c = item['components']
        if item['description']['identifier'] not in required:
            continue
        animation = c.get('minecraft:use_animation')
        value = animation.get('value') if isinstance(animation, dict) else animation
        assert value == 'eat', (file, value)
        assert c['minecraft:use_modifiers']['use_duration'] > 0, file
        foods.add(item['description']['identifier'])
    assert foods == required, required - foods
    # Native arm animation must still carry the same attachable/bite stages.
    skewers = 0
    for file in (RP / 'attachables').glob('*_skewer.attachable.json'):
        d = json.loads(file.read_text())['minecraft:attachable']['description']
        if version >= (2,8,68) and d['identifier']=='kaleidoscope_grilling:unfinished_skewer':
            assert d['identifier'] not in required, file
            assert d['render_controllers']==['controller.render.kg_secret_held.stick']+[f'controller.render.kg_partial_held.{i}' for i in range(2)],file
            assert not any(key.startswith(('eat_','fp_eat_')) for key in d['animations']),file
            continue
        if d['identifier'] == 'kaleidoscope_grilling:secret_skewer':
            expected=['controller.render.kg_secret_held.stick']+[f'controller.render.kg_secret_held.{i}' for i in range(3)]
            if version>=(2,8,68):expected+=['controller.render.kg_secret_held.piece']
            assert d['render_controllers']==expected,file
        else:
            assert 'controller.render.kg_a22.bite' in d['render_controllers'], file
        assert 'q.is_using_item' in ' '.join(d['scripts']['pre_animation']), file
        skewers += 1
    assert skewers == (40 if (RP / 'attachables/secret_skewer.attachable.json').exists() else 39), skewers
    print(f'A284: {len(foods)} native eating items, {skewers} bite-stage attachables; scoped limb channels, no whole-player override')


if __name__ == '__main__':
    eating_gate()
    previous_gate()
