# Unreleased — RawMessage snapshot comparison

- Fix false metadata-readback failures when item snapshot lore returns in an equivalent literal or single-node RawMessage representation. Reuse the existing bottle-lore comparator rather than weakening all metadata checks.
- Preserve corruption checks for actual lore/content changes and all non-lore metadata. Saved lore and ownership matching are unchanged.
- Add a focused executable regression and a Python unittest entry. Baseline: 16/23 passing; candidate: 23/23 passing. These are mocked codec tests, not client acceptance.
- No addon was packaged, versioned, released or deployed by this source change. Full-family release checks and same-bottle gameplay verification remain required; see the evidence note.
