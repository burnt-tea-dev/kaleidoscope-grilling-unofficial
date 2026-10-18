"""G153 user-reported runtime repairs, with exact historical-source recovery."""
from verify_a28152 import main as previous


def main(expected_version=(2, 8, 153)):
    previous(expected_version=expected_version)
    # Final composed gate must also run the specific repair semantic suites;
    # byte ownership alone does not establish harvest, rack or held rendering.
    from pathlib import Path
    import sys
    root=Path(__file__).resolve().parents[2]
    from verification_session import run_checked_once
    commands=[
        [sys.executable,'-B','tools/test_g153_repair_source.py'],
        [sys.executable,'-B','tools/test_g153_composition.py'],
        [sys.executable,'-B','tools/test_g153_repair_compiler.py'],
        [sys.executable,'-B','tools/test_g153_scoped_builder_boundaries.py'],
        [sys.executable,'-B','tools/test_crop_geometry.py'],
        [sys.executable,'-B','tools/test_fortress_loot_current.py'],
        [sys.executable,'-B','tools/check_grilling_guide.py'],
        [sys.executable,'-B','development/gameplay_core/test_oil_brush_assets.py'],
        ['node','--test','development/gameplay_core/test_oil_brush_visual.mjs'],
        ['node','--experimental-vm-modules','--test','development/tests/runtime/pepper_harvest_conservation.test.mjs'],
        ['node','--test','development/gameplay_core/test_rack_visual_selection.mjs','development/gameplay_core/test_rack_transactions.mjs','development/gameplay_core/test_rack_geometry.mjs','development/gameplay_core/test_rack_aim_hit.mjs','development/gameplay_core/test_rack_tool_runtime.mjs'],
    ]
    for command in commands:run_checked_once(command,cwd=root)
    print('G153 exact source and repair checks PASS; BDS/client acceptance separate')


if __name__=='__main__':main()
