# A2.8.151 skewer repair candidate

Grilling **2.8.151** requires the reviewed public **Cookery 1.6.1** BP/RP pair and the complete family's registered **family API 0.2.12**. The Board API saved-data schema stays **0.1.0**.

## Changes

- Restore the Cookery 1.6.1 chopping-board integration used to obtain skewer ingredients. Match the author's current beef declaration and chicken multi-output declaration strictly. Grilling's beef replacement gives two beef chunks; chicken retains the author's three meat pieces and one bone, then adds the established chicken-skin yield. Preserve transactional delivery and older saved-board contracts.
- Show the correct one-, two- or three-ingredient recipe progress. Keep the original Java ordered recipe matching. Before spending another ingredient, verify that every saved ingredient in the resulting skewer can be restored; invalid nested secret skewers are rejected too.
- Add the missing ingredient attachable for `secret_skewer_native_plain`, used when custom eating animations are disabled. Retain its ordinary 25-tick native use and static first/third-person poses.
- Append Cookery's tea egg, butter tea, clay-pot milk tea and mystery tea to the existing ingredient display catalog. Preserve the old item indices and bottle/slime/failure channel ownership across held, grill and plate projections.
- Validate the same three saved ingredients at use start and at custom/native settlement. Reject missing, malformed, unavailable or stale contents; recover missing food facts for recognizable legacy ingredients without replacing explicit zero values. Native completion must still belong to the captured slot and stack, with at most its legitimate one-item debit.

The repair details, source references and verification boundaries are recorded in [the skewer repair review](evidence/skewer-repair-20261017.md). The custom per-stack inventory icon limitation and other open presentation work retain their existing status.

## Delivery and acceptance

`publication_request=false` records this source candidate. Publication, full-family assembly and deployment each require their actual completion record; merging this source alone does not update a player's installed pack. The G149 public release and older LIVE evidence retain their original identities.

The candidate must pass canonical source/compiler CI, the complete-family static checks and a fresh stopped-world load/restart before deployment. Script/API-double results do not certify rendered Minecraft behavior. `client=false`, `production_ready=false`, `live=false` and `live_deployment=false` remain the candidate metadata until separately recorded evidence justifies a change.
