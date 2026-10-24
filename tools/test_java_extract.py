"""Java data extraction regressions, independent of retired geometry tests."""
import json
import unittest


class JavaDataExtractionTests(unittest.TestCase):
    """Regression coverage for the pinned Java reference data extractor."""

    def test_literal_arithmetic_does_not_execute_source(self):
        from java_extract.common import number
        self.assertEqual(number('5L * 20L'), 100)
        self.assertEqual(number('-7 / 2'), -3)
        self.assertEqual(number('0xFF'), 255)
        self.assertEqual(number('0xFFL'), 255)
        self.assertEqual(number('90F / 20F'), 4.5)
        self.assertEqual(number('-7 % 3'), -1)
        self.assertEqual(number('0xFFFFFFFF'), -1)
        with self.assertRaises(ValueError): number('(int)1.75F')
        with self.assertRaises(ValueError): number('2147483647 + 1')
        with self.assertRaises(ValueError): number('1 << 32')
        self.assertEqual(number('0.95833F'), 0.95833)
        with self.assertRaises(ValueError):
            number('__import__("os").system("echo unexpected")')
        with self.assertRaises(ValueError):
            number('Math.random() * 20')

    def test_numeric_reader_handles_comments_strings_arrays_and_symbols(self):
        from java_extract.domains import numeric_declarations, numeric_rules
        source = """class Sample {
          // int fake = 99;
          private static final int TICKS = 5L * 20L;
          private static final float[] KEYS = {0F, .5F, 1F};
          private static final int SYMBOLIC = TICKS * 2;
          public void draw() {
            String label = "item/100 // still a string";
            String example = "int notAField = 99;";
            int width = 102;
          }
        }"""
        rows = {row['name']: row for row in numeric_declarations(source)}
        self.assertEqual(set(rows), {'TICKS', 'KEYS', 'SYMBOLIC', 'width'})
        self.assertEqual(rows['TICKS']['value'], 100)
        self.assertEqual(rows['KEYS']['value'], [0, .5, 1])
        self.assertNotIn('value', rows['SYMBOLIC'])
        rules = numeric_rules(source)
        self.assertFalse(any('label' in row['expression'] or 'example' in row['expression'] for row in rules))
        self.assertEqual(next(row['method'] for row in rules if 'width' in row['expression']), 'draw')
        changed = {row['name']: row for row in numeric_declarations(source.replace('102', '174'))}
        self.assertEqual(changed['width']['value'], 174)

    def test_balanced_calls_keep_nested_arguments_and_strings(self):
        from java_extract.common import calls
        source = 'register("a,b", make(1, nested(2, 3)), new int[] {4, 5}); // register("fake")'
        rows = list(calls(source, 'register'))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][1], ['"a,b"', 'make(1, nested(2, 3))', 'new int[] {4, 5}'])

    def test_generated_tables_keep_units_and_loader_identity(self):
        from pathlib import Path
        folder = Path(__file__).resolve().parents[1] / 'data/java'
        foods = json.loads((folder/'foods.json').read_text())
        profiles = json.loads((folder/'eating_profiles.json').read_text())
        heat = json.loads((folder/'heat.json').read_text())
        hud = json.loads((folder/'hud.json').read_text())
        for loader in ('forge-1.20.1', 'neoforge-1.21.1'):
            items = foods['loaders'][loader]['items']
            self.assertEqual(items['kaleidoscope_grilling:raw_beef_skewer']['nutrition'], 2)
            raw = items['kaleidoscope_grilling:raw_caterpillar_skewer']
            self.assertEqual(raw['authored_effects'], [{'id': 'minecraft:nausea', 'duration_ticks': 60}])
            self.assertEqual(raw['effective_effects'], [])
            self.assertEqual(items['kaleidoscope_grilling:grilled_beef_skewer']['saturation_modifier'], .6)
            self.assertEqual(profiles['loaders'][loader]['profiles']['THREE']['duration_ticks'], 100)
            self.assertEqual(profiles['loaders'][loader]['profiles']['FOUR']['bite_seconds'], [.95833, 2.33333, 3.45833, 4.08333])
            self.assertEqual(heat['parameters'][loader]['heat_bucket_ticks']['value'], 100)
            self.assertEqual(heat['parameters'][loader]['oil_heat_ticks']['values'], {'secret_chili': 12000, 'premium_chili': 24000, 'default': 1200})
            self.assertEqual(hud['parameters'][loader]['eating_bar_width']['value'], 102)
            self.assertEqual(hud['parameters'][loader]['offset_from_screen_center_x_and_bottom_y']['x']['value'], -1)
        recipes = json.loads((folder/'recipes.json').read_text())['resources']
        self.assertEqual(sum('/recipe/' in name for name in recipes), sum('/recipes/' in name for name in recipes))
        self.assertTrue(any('/mixing/' in name for name in recipes))
        shapes = json.loads((folder/'collision_shapes.json').read_text())['classes']
        bottle = next(row for name, row in shapes.items() if name.endswith('seasoning/SeasoningBottleBlock.java'))
        self.assertEqual(len(bottle['boxes']), 4)
        self.assertTrue(any(12.25 in row.get('bounds', []) for row in bottle['boxes']))

    def test_external_values_keep_publisher_provenance(self):
        from pathlib import Path
        folder = Path(__file__).resolve().parents[1] / 'data/java'
        dims = json.loads((folder/'minecraft_dimensions.json').read_text())
        self.assertIsNone(dims['source_commit'])
        for version in ('1.20.1', '1.21.1'):
            data = dims['versions'][version]['dimensions']
            self.assertEqual((data['overworld']['min_y'], data['overworld']['logical_max_y']), (-64, 319))
            self.assertEqual(data['the_nether']['height'], 256)
            self.assertEqual(data['the_nether']['logical_max_y'], 127)
            self.assertEqual(data['the_end']['logical_max_y'], 255)
        assets = json.loads((folder/'minecraft_assets.json').read_text())
        self.assertEqual(len(assets['events']), 7)
        self.assertEqual(len(assets['particle_sprites']), 9)
        palette = json.loads((folder/'seasoning_colors.json').read_text())
        self.assertEqual(palette['ingredients']['minecraft:redstone']['rgb'], [11144961, 4261120])
        self.assertEqual(palette['ingredients']['kaleidoscope_grilling:dragon_egg_powder']['rgb'], [263178, 1639723])
        index = json.loads((folder/'external_sources.json').read_text())
        self.assertEqual(len(index['fixtures']), 21)
        self.assertTrue(all('preserved_content' not in row for row in index['fixtures']))

    def test_output_check_detects_missing_changed_and_extra_files(self):
        from pathlib import Path
        from tempfile import TemporaryDirectory
        from java_extract.extract import write_or_check
        with TemporaryDirectory() as directory:
            path = Path(directory)
            expected = {'values.json': b'{"value": 25}\n'}
            write_or_check(expected, path)
            write_or_check(expected, path, True)
            (path/'values.json').write_text('{"value": 24}\n')
            with self.assertRaises(ValueError): write_or_check(expected, path, True)
            (path/'values.json').unlink()
            with self.assertRaises(ValueError): write_or_check(expected, path, True)
            (path/'unrelated.json').write_text('{}')
            with self.assertRaises(ValueError): write_or_check(expected, path)


class SkewerSourceMotionTests(unittest.TestCase):
    """Execute the pinned classes, not copies of their animation formulas."""
    @classmethod
    def setUpClass(cls):
        import subprocess,sys,tempfile
        from pathlib import Path
        from skewer_animation.motion import ROOT
        cls.directory=tempfile.TemporaryDirectory(prefix='skewer-source-test-')
        output=Path(cls.directory.name)/'oracle.jsonl'
        subprocess.run([sys.executable,str(ROOT/'tools/skewer_animation/java_oracle/run.py'),
                        '--math-trig','--output',str(output)],check=True,capture_output=True,text=True)
        cls.rows=[json.loads(line)for line in output.read_text().splitlines()]

    @classmethod
    def tearDownClass(cls):cls.directory.cleanup()

    def test_all_five_motion_families_and_hands_against_unmodified_java(self):
        import math
        from skewer_animation.motion import sample,arm_pose,item_operations,PROFILES
        self.assertEqual({r['profile']for r in self.rows},set(PROFILES))
        self.assertEqual({r['side']for r in self.rows},{'LEFT','RIGHT'})
        self.assertGreater(len(self.rows),3000)
        for row in self.rows:
            profile,side,t=row['profile'],row['side'].lower(),row['seconds_requested']
            pose=sample(profile,t)
            for helper,key in [(False,'active')]+([(True,'helper')]if pose['helper']else[]):
                actual_side=row['helper_side'].lower()if helper else side
                actual=arm_pose(profile,actual_side,pose[key],helper)
                expected=row['applied_helper_arm'if helper else'applied_active_arm']
                expected=expected[:3]+[math.degrees(v)for v in expected[3:]]
                for a,b in zip(actual,expected):self.assertAlmostEqual(a,b,delta=.00025,msg=str((profile,side,t,helper)))
            for helper,key in [(False,'main')]+([(True,'piece')]if pose['piece']else[]):
                actual_side=row['helper_side'].lower()if helper else side
                ops=item_operations(profile,actual_side,pose[key],helper)
                expected=row['second_item_ops'if helper else'main_item_ops']
                self.assertEqual(len(ops),len(expected))
                for (kind,value),java in zip(ops,expected):
                    if kind in ('translate','scale'):
                        self.assertEqual(kind,java[0]);want=[x*(16 if kind=='translate'else 1)for x in java[1:]]
                        for a,b in zip(value,want):self.assertAlmostEqual(a,b,delta=.00015)
                    else:
                        self.assertEqual([kind.upper()],java[1:2]);self.assertAlmostEqual(value,java[2],delta=.00015)

    def test_nonuniform_source_times_keep_uniform_catmull_rom_and_scalar_angles(self):
        from skewer_animation.motion import catmull
        self.assertEqual(catmull(-1,[0,1,9],[10,20,30]),10)
        self.assertEqual(catmull(10,[0,1,9],[10,20,30]),30)
        self.assertAlmostEqual(catmull(.5,[0,1,9],[10,20,30]),14.375)
        self.assertEqual(catmull(.5,[0,1],[170,-170]),0)
        with self.assertRaises(ValueError):catmull(0,[0,0],[1,2])

    def test_item_pose_decomposition_preserves_java_matrix_order_for_both_hands(self):
        from skewer_animation.compiler import channels,bedrock_item_matrix
        from skewer_animation.motion import sample,compose,translate,rotate,scale,point
        for profile in ('ONE','TWO','THREE','THREE_ALT','FOUR'):
            for side in ('left','right'):
                for t in (0,.5,1.2,2.4,3.6,4.4):
                    pose=sample(profile,t)
                    for helper in ([False,True]if pose['piece']else[False]):
                        physical=('left'if side=='right'else'right')if helper else side
                        value=pose['piece'if helper else'main']
                        ch=channels(profile,side,t,helper)
                        x,y,z=ch['rotation']
                        # Explicit existing Bedrock item-slot basis, not a claim
                        # about camera calibration or an engine transformation.
                        emitted=compose(translate(*ch['position']),rotate('z',-z),rotate('y',y),rotate('x',-x),scale(*ch['scale']))
                        expected=bedrock_item_matrix(profile,physical,value,helper)
                        for vertex in ([0,0,0],[2,4,8],[-3,9,-2]):
                            for a,b in zip(point(emitted,vertex),point(expected,vertex)):
                                self.assertAlmostEqual(a,b,places=6)

    def test_actual_emitted_clip_interpolation_and_helper_scale_are_bounded(self):
        import bisect,subprocess
        from skewer_animation.compiler import RP,bedrock_item_matrix
        from skewer_animation.motion import sample,compose,translate,rotate,scale,point
        clips=json.loads((RP/'animations/java_eating_projection.animation.json').read_text())['animations']
        def interpolate(track,t):
            if not isinstance(track,dict):return track
            keys=sorted((float(k),v)for k,v in track.items());times=[k for k,v in keys]
            if t<=times[0]:return keys[0][1]
            if t>=times[-1]:return keys[-1][1]
            r=bisect.bisect_left(times,t);a,b=keys[r-1:r+1];f=(t-a[0])/(b[0]-a[0])
            return [v+(w-v)*f for v,w in zip(a[1],b[1])]
        requests=[]
        for p in ('ONE','THREE'):
            clip=clips['animation.kg_java_eating.item.'+p.lower()+'.right']
            requests.append({'profile':p,'expression':clip['bones']['dual_piece']['scale'][0],
                             'times':[i/1000 for i in range(int(clip['animation_length']*1000)+1)]})
        # Evaluate actual emitted JSON arithmetic, not translated runtime JS.
        script="const {Script,createContext}=require('node:vm');let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>{const out={};for(const r of JSON.parse(s)){const vm=new Script(r.expression),c=createContext({v:{kg_eat_seconds:0}});out[r.profile]=r.times.map(t=>{c.v.kg_eat_seconds=t;return vm.runInContext(c)});}process.stdout.write(JSON.stringify(out));});"
        result=subprocess.run(['node','-e',script],input=json.dumps(requests),text=True,capture_output=True,check=True)
        scales=json.loads(result.stdout)
        worst=0
        for name,clip in clips.items():
            p,side=name.rsplit('.',2)[-2:];p=p.upper()
            for ms in range(0,int(clip['animation_length']*1000)+1,3):
                t=ms/1000;pose=sample(p,t)
                for helper,bone in [(False,'skewer_pose')]+([(True,'dual_piece')]if pose['piece']else[]):
                    actual_side=('left'if side=='right'else'right')if helper else side
                    value=pose['piece'if helper else'main']
                    size=scales[p][ms]if helper else 1
                    if helper:
                        self.assertAlmostEqual(size,value[6],places=7)
                        if size<=.001:continue  # Source mixin does not draw it.
                    channels=clip['bones'][bone]
                    pos=interpolate(channels['position'],t);x,y,z=interpolate(channels['rotation'],t)
                    emitted=compose(translate(*pos),rotate('z',-z),rotate('y',y),rotate('x',-x),scale(size,size,size))
                    expected=bedrock_item_matrix(p,actual_side,value,helper)
                    for vertex in ([0,0,0],[3,9,13],[-3,9,-2]):
                        error=max(abs(a-b)for a,b in zip(point(emitted,vertex),point(expected,vertex)))
                        worst=max(worst,error)
        self.assertLess(worst,.05,'actual emitted linear interpolation exceeds .05 model pixels')

    def test_actual_emitted_arm_interpolation_has_a_separate_accuracy_bound(self):
        import bisect
        from skewer_animation.compiler import RP
        from skewer_animation.motion import sample,arm_pose
        clips=json.loads((RP/'animations/java_eating_player.animation.json').read_text())['animations']
        worst_position=worst_rotation=0
        for name,clip in clips.items():
            profile,side=name.rsplit('.',2)[-2:];profile=profile.upper()
            for physical,helper in [(side,False)]+([('left'if side=='right'else'right',True)]if profile in ('ONE','THREE')else[]):
                bone=clip['bones'][physical+'arm'];tracks={}
                for channel in ('position','rotation'):
                    rows=sorted((float(k),[float(v.partition(' - q.get_default_bone_pivot(')[0])if isinstance(v,str)else v for v in values])for k,values in bone[channel].items())
                    tracks[channel]=([t for t,v in rows],rows)
                for ms in range(0,int(clip['animation_length']*1000)+1,3):
                    t=ms/1000;pose=arm_pose(profile,physical,sample(profile,t)['helper'if helper else'active'],helper)
                    desired={'position':[-pose[0],22.096-pose[1],-pose[2]],'rotation':[180+pose[3],-pose[4],180-pose[5]]}
                    for channel,(times,rows)in tracks.items():
                        r=bisect.bisect_left(times,t)
                        if r==0:actual=rows[0][1]
                        elif r==len(rows):actual=rows[-1][1]
                        else:
                            a,b=rows[r-1:r+1];f=(t-a[0])/(b[0]-a[0]);actual=[v+(w-v)*f for v,w in zip(a[1],b[1])]
                        error=max(abs(a-b)for a,b in zip(actual,desired[channel]))
                        if channel=='position':worst_position=max(worst_position,error)
                        else:worst_rotation=max(worst_rotation,error)
        self.assertLess(worst_position,.1,'emitted arm target error in model pixels')
        self.assertLess(worst_rotation,.5,'emitted scalar arm angle error in degrees')

    def test_one_right_arm_has_no_extra_profile_specific_vertical_shift(self):
        from skewer_animation.compiler import RP
        from skewer_animation.motion import sample,arm_pose
        document=json.loads((RP/'animations/java_eating_player.animation.json').read_text())
        clip=document['animations']['animation.kg_java_eating.player.one.right']
        for side,helper in [('right',False),('left',True)]:
            for key,values in clip['bones'][side+'arm']['position'].items():
                pose=arm_pose('ONE',side,sample('ONE',float(key))['helper'if helper else'active'],helper)
                expected=[-pose[0],22.096-pose[1],-pose[2]]
                # The JSON channel is a constant target minus the native default
                # pivot. Evaluate it at the zero reference pivot in this test.
                actual=[float(v.partition(' - q.get_default_bone_pivot(')[0])for v in values]
                for a,b in zip(actual,expected):self.assertAlmostEqual(a,b,places=6)

if __name__ == '__main__': unittest.main()
