#!/usr/bin/env python3
"""Compile unchanged pinned Java animation sources; sample with documented test stubs.

No network, no Minecraft installation, no canonical pack changes, no committed binaries.
"""
from pathlib import Path
import argparse,hashlib,json,subprocess,tempfile
HERE=Path(__file__).resolve().parent
REPO=HERE.parents[2]
SOURCES=REPO/'projects/grilling/integration/immersion_lab/sources/forge-1.20.1/src/main/java/cn/breezeth/kaleidoscope_grilling/skewer'
HASHES={'SkewerEatingAnimation.java':'b4e97ccd8fd30b0b928315ce07a0f7e68489cce3efe3b7dd9892c021c8ed95eb','EnderPearlEatingAnimation.java':'eab24f1e87a0d4f67abb3bd1b6d3804c90ba3d5fce39eb7c3d7760982dec244d'}
def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--output',type=Path,required=True)
 p.add_argument('--profile',choices=['ONE','TWO','THREE','THREE_ALT','FOUR'])
 p.add_argument('--side',choices=['LEFT','RIGHT'],default='RIGHT')
 p.add_argument('--seconds',type=float,default=0)
 p.add_argument('--math-trig',action='store_true',help='Use direct Math trig instead of float sine lookup test surrogate')
 a=p.parse_args()
 for name,sha in HASHES.items():
  actual=hashlib.sha256((SOURCES/name).read_bytes()).hexdigest()
  if actual!=sha:raise SystemExit(f'Pinned source hash mismatch: {name}: {actual}')
 java_sources=[str(HERE/'OracleMain.java'),*[str(p) for p in (HERE/'stubs').rglob('*.java')],*[str(SOURCES/n) for n in HASHES]]
 with tempfile.TemporaryDirectory(prefix='skewer-java-oracle-') as d:
  subprocess.run(['java','-m','jdk.compiler/com.sun.tools.javac.Main','-source','17','-target','17','-d',d,*java_sources],check=True)
  cmd=['java',f'-Doracle.mathTrig={str(a.math_trig).lower()}','-cp',d,'OracleMain']
  if a.profile:cmd += [a.profile,a.side,str(a.seconds)]
  completed=subprocess.run(cmd,text=True,capture_output=True,check=True)
  samples=[json.loads(line) for line in completed.stdout.splitlines()]
 a.output.parent.mkdir(parents=True,exist_ok=True)
 a.output.write_text(completed.stdout)
 metadata={'source_commit':'9a1acdab27698457bec16c9362678e574895a28c','source_repository':'https://github.com/breezeth-CN/KaleidoscopeGrilling','sources_sha256':HASHES,'animation_source_modified':False,'java_client_observed':False,'engine_oracle':False,'dependency_scope':'Mth/Player/ModelPart/PoseStack/Axis/debug/profile test surrogates; no MC classpath','trig_surrogate':'direct-java-Math' if a.math_trig else 'minecraft-style-65536-float-sine-table','pose_stack':'ordered API-call recorder, not JOML matrices','applied_arm_order':['x','y','z','xRot_radians','yRot_radians','zRot_radians'],'samples':len(samples),'output_sha256':hashlib.sha256(completed.stdout.encode()).hexdigest(),'java_version':subprocess.run(['java','-version'],capture_output=True,text=True).stderr.strip()}
 a.output.with_suffix(a.output.suffix+'.meta.json').write_text(json.dumps(metadata,indent=2)+'\n')
 print(json.dumps(metadata,indent=2))
if __name__=='__main__':main()
