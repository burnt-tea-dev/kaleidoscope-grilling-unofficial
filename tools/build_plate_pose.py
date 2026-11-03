#!/usr/bin/env python3
"""Source-derived idle pose candidate; default check never writes.

Explicit --apply is source authoring, not a ZIP patch or native acceptance.
The separate plate_camera_pose diagnostic remains strictly read-only.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import plate_camera_pose as math
ROOT = Path(__file__).resolve().parents[1]
PROFILE = ROOT / 'data/plate-idle-calibration.json'
POSE = math.POSE


def transpose(matrix):
    return list(map(list, zip(*matrix)))


def derive(document, profile):
    """Solve the complete affine constant term, not a projected screen box.

    q=S*D*(arm*(R*(s*u)+D*position+item)+origin+offset)
      +(0,S*Yshift-eye,0), with u=A*J+(0,-8,0).
    Set q(J=0)=C*(JavaArm+JavaDisplay). Linear rotation is retained.
    """
    h, j = profile['host'], profile['java']
    if h['client'] != '1.26.60.4' or j['minecraft'] != '1.20.1':
        raise ValueError('Unreviewed engine identity')
    if j['display_right_rotation'] != [0, -135, 0]:
        raise ValueError('Unreviewed Java display rotation; fixed affine contract requires [0,-135,0]')
    if profile['client_acceptance'] or profile['production_ready']:
        raise ValueError('This generator does not certify runtime acceptance')
    if profile['evidence']['postcapture_refit']:
        raise ValueError('Control calibration was refitted after capture')
    result = copy.deepcopy(document)
    s = j['display_scale'] / h['uniform_scale']
    for hand, sign in [('right', 1), ('left', -1)]:
        pose = result['animations']['animation.kg_plate_held.fp_' + hand]['bones']['plate_pose']
        arm, origin, item = math.holder(hand)
        # Verify the retained linear part against Java display, independently
        # of the constant-term solve. Wrong rotation must fail, not be refitted.
        rotation = math.rotation(pose['rotation'])
        java_rotation = math.rotation([0, -135*sign, 0])
        for axis in range(3):
            u = [0, 0, 0]; u[axis] = (-1, -1, 1)[axis]
            actual = math.transform(arm, math.transform(rotation, u))
            wanted = math.transform(java_rotation, [int(i == axis) for i in range(3)])
            actual = [actual[i]*(1, -1, 1)[i] for i in range(3)]
            wanted = [wanted[i]*(1, 1, -1)[i] for i in range(3)]
            if max(abs(actual[i]-wanted[i]) for i in range(3)) > 1e-8:
                raise ValueError('Retained rotation differs from Java linear transform')
        jt = [j['arm_translation_blocks'][i]*16 + j['display_translation_pixels'][i] for i in range(3)]
        jt[0] *= sign
        target = [jt[0], jt[1], -jt[2]]
        target[1] -= h['uniform_scale']*h['y_shift'] - h['eye_pixels']
        holder = [target[i]/h['uniform_scale'] * (1, -1, 1)[i] - origin[i] for i in range(3)]
        holder[0] += sign*h['attachable_x_offset']
        local = math.transform(transpose(arm), holder)
        zero = math.transform(math.rotation(pose['rotation']), [0, -8*s, 0])
        pose['position'] = [(local[i]-item[i]-zero[i])*(1, -1, 1)[i] for i in range(3)]
        pose['scale'] = [s]*3
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='explicit canonical source authoring only')
    args = parser.parse_args()
    profile = json.loads(PROFILE.read_text())
    if json.loads((ROOT/'baseline.json').read_text())['version'] != profile['candidate_version']:
        raise SystemExit('Candidate version differs from the source profile')
    original = json.loads(POSE.read_text())
    result = derive(original, profile)
    if args.apply:
        POSE.write_text(json.dumps(result, indent=2)+'\n')
    elif original != result:
        raise SystemExit('FP pose differs from reviewed affine source; explicit --apply required')
    print(json.dumps({'profile': profile['profile'], 'profile_sha256': hashlib.sha256(PROFILE.read_bytes()).hexdigest(), 'version':profile['candidate_version'], 'client':False,'production_ready':False,'wrote_source':args.apply}))

if __name__ == '__main__':
    main()
