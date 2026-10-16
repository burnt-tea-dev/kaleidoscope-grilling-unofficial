# A2.8.150 stable candidate

Grilling **2.8.150** requires the reviewed public **Cookery 1.6.1** BP/RP pair. The family API is **0.2.11**. This candidate retains the earlier Grilling animation, item-use and guide repairs, while adapting the host integration to Cookery's current locale handling. The existing exact dependency and source checks remain required.

The grill now uses the original Java four-pixel height for both collision and selection. The advanced rack restores its original narrow rear shape for every facing, and rack targeting follows that facing. This removes the oversized invisible front area while retaining the rack's saved slots and display layout. See [the source shapes and verification limits](evidence/collision-shapes-20261016.md).

Both active bridge projects use the same G150 output identity. These project settings do not transform exported gameplay or replace canonical runtime files.

`publication_request=false`: this is current candidate metadata, not a request to publish a GitHub release. The existing G149 publication request, notes and exact artifacts remain in Git history with their original scope. No G149 source or archive digest is assigned to G150. A future publication requires a separate request with the exact G150 artifacts, source commit and successful complete-tree validation.

Canonical source and compiler CI, the full family checks and saved-world admission must complete for this candidate before deployment. Those checks do not prove the rendered client result or native collision accuracy. `client=false`, `production_ready=false`, `live=false` and `live_deployment=false` remain the state of this candidate record; actual deployment and human acceptance are recorded separately.
