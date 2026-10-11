"""Evaluate the generated timer expression, independent of native visual QA."""
import ast,json,subprocess,unittest
from pathlib import Path
from native_eating_clock import SECONDS,TICKS,ASSIGNMENT
ROOT=Path(__file__).resolve().parents[2]
def evaluate(ticks,remaining,alpha,using=True):
    text=SECONDS.replace(TICKS,repr(ticks)).replace('q.is_using_item',str(int(using))).replace('q.main_hand_item_use_duration',repr(remaining)).replace('q.frame_alpha',repr(alpha))
    condition,choices=text[1:-1].split('?',1);yes,no=choices.rsplit(':',1)
    text='('+yes+') if ('+condition+') else ('+no+')'
    text=text.replace('&&',' and ').replace('math.clamp','clamp')
    parsed=ast.parse(text,mode='eval')
    allowed=(ast.Expression,ast.IfExp,ast.BoolOp,ast.And,ast.Compare,ast.Gt,ast.Constant,ast.Call,ast.Name,ast.Load,ast.BinOp,ast.Add,ast.Sub,ast.Div,ast.UnaryOp,ast.USub)
    assert all(isinstance(n,allowed) for n in ast.walk(parsed))
    assert all(n.id=='clamp' for n in ast.walk(parsed) if isinstance(n,ast.Name))
    return eval(compile(parsed,'<generated-eating-clock>','eval'),{'__builtins__':{},'clamp':lambda n,lo,hi:max(lo,min(hi,n))})
class NativeEatingClock(unittest.TestCase):
    def test_real_generated_expression_in_seconds(self):
        for ticks in (90,100):
            for used in range(ticks+3):
                for alpha in (0,.25,.5,.999):
                    expected=max(0,min(ticks/20,(used+alpha-1)/20))
                    self.assertAlmostEqual(evaluate(ticks,ticks-used,alpha),expected)
    def test_idle_missing_sync_and_restart_are_zero(self):
        for remain in (0,1,90,72000):
            self.assertEqual(evaluate(0,remain,.5),0)
            self.assertEqual(evaluate(90,remain,.5,False),0)
        self.assertEqual(evaluate(90,90,0),0)
        self.assertEqual(evaluate(100,100,.9),0)
    def test_mainhand_max_and_buggy_query_family_not_used(self):
        self.assertNotIn('item_in_use_duration',SECONDS)
        self.assertNotIn('item_max_use_duration',SECONDS)
        self.assertNotIn('main_hand_item_max_duration',SECONDS)
        self.assertNotIn('/ 400',SECONDS)
        # Different hand/item durations are supplied by the actual start event.
        self.assertAlmostEqual(evaluate(100,60,.5),(40+.5-1)/20)
    def test_generated_channels_and_property(self):
        p=ROOT/'projects/grilling/gameplay_core';rp=p/'resource_pack';bp=p/'behavior_pack'
        names=['eating_motion.animation.json','java_eating_projection.animation.json','java_eating_player.animation.json']
        version=tuple(json.loads((bp/'manifest.json').read_text())['header']['version'])
        if version>=(2,8,126):names+=['kg_probe_caterpillar_item.animation.json','kg_probe_caterpillar_player.animation.json']
        for name in names:
            for a in json.loads((rp/'animations'/name).read_text())['animations'].values():self.assertEqual(a['anim_time_update'],SECONDS)
        props=json.loads((bp/'entities/player.json').read_text())['minecraft:entity']['description']['properties']
        self.assertEqual(props['kaleidoscope_grilling:eat_native_ticks'],{'type':'int','range':[0,72000],'default':0,'client_sync':True})
        checked=0
        for path in (rp/'attachables').glob('*.json'):
            pre=json.loads(path.read_text())['minecraft:attachable']['description']['scripts'].get('pre_animation',[])
            if pre and pre[0]==ASSIGNMENT:
                checked+=1;self.assertNotIn('q.item_in_use_duration',' '.join(pre))
        self.assertGreater(checked,30)
    def test_duration_input_and_cleanup_source(self):
        module=ROOT/'projects/grilling/gameplay_core/behavior_pack/scripts/player_presentation_core.js'
        js="import {eatingNativeTicks} from "+json.dumps(module.as_uri())+"; for(const [a,b] of [[90,90],[100,100],[0,0],[-1,0],[90.5,0],[72001,0],[NaN,0],[Infinity,0],[undefined,0]]) if(eatingNativeTicks(a)!==b) throw Error('Invalid duration');"
        subprocess.run(['node','--input-type=module','-e',js],check=True)
        s=(module.parent/'main.js').read_text()
        self.assertIn('eatingNativeTicks(a.nativeDuration)',s)
        version=tuple(json.loads((module.parent.parent/'manifest.json').read_text())['header']['version'])
        admitted="supportsJavaEatingProjection(e.itemStack.typeId,profile)"
        if version>=(2,8,126):
            admitted="("+admitted+"||(e.itemStack.typeId==='kaleidoscope_grilling:grilled_caterpillar_skewer'&&profile==='ONE'&&hand!=='off'))"
        self.assertEqual(s.count("if(eatingNativeTicks(a.nativeDuration)>0&&"+admitted),1)
        for key in ('itemStartUse','itemCompleteUse','itemStopUse','playerSpawn'):
            section=s.split('world.afterEvents.'+key+'.subscribe',1)[1].split('world.',1)[0]
            self.assertIn('EAT_NATIVE_TICKS_PROPERTY',section,key)
if __name__=='__main__':unittest.main()
