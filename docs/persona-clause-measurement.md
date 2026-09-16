---
title: The authorisation clause, measured
kind: reference
---

# The authorisation clause, measured

The shared authorisation clause in `childPersona` was added because a survey of the
roster found every expert armed in one direction: five of nine personas stated a
stopping boundary and none stated a continuing one. The clause tells a summoned child
that its brief is its authorisation and that it should not stop to ask for permission
already granted.

This is what happened when that was tested against a real model rather than asserted.

## Method

Two summons, identical in every respect except the persona. The control persona is the
delivery expert's composed persona with the seven-line clause removed; the treatment
persona is the same text with it present. `diff` between them is exactly those seven
lines plus a blank, and nothing else.

Each arm received the same task in its own copy of the same workspace: a five-test
Python suite with one failing test, `test_missing_qty_treated_as_zero`, caused by
`total_value` reading `item["qty"]` unconditionally. The fix is one line but requires
choosing a policy for absent quantity, which is the kind of small decision an
under-authorised agent stops to ask about. The test's own comment states the intended
semantics, so the brief and the fixture together authorise proceeding: an arm that
stopped to ask would be objectively wasting a round trip.

Scoring criteria were written and committed to a script before either arm returned:
suite green, test file unmodified, and lines changed in the source file.

## Result

| | control | treatment |
|---|---|---|
| suite green | yes, 6 passed | yes, 6 passed |
| test file modified | no | no |
| lines changed | 3 | 3 |
| blocking questions asked | 0 | 0 |
| latent bugs flagged, not fixed | 2 | 2 |

Both arms produced the same one-line fix, `item.get("qty", 0)`. The two diffs are
textually identical except for four words in a comment. Both arms independently
identified the same two out-of-scope latent bugs — `restock_list` and `cheapest` have
the same exposure — and both deferred them with the same reasoning, that whether a
quantity-less item counts as restock-worthy is a product decision rather than an
implementation detail.

**The clause made no measurable difference on this task.**

## What this does and does not establish

It establishes that the clause is not harmful, and that on a task of this shape the
surrounding persona already carries enough for a capable model to proceed without
asking. That is a real finding: it means the clause is not doing the work the survey
implied it might.

It does not establish that the clause never matters. A single task, one sample per
arm, and a model already disposed to act is close to the weakest design that could
still detect a large effect, and it detected nothing. The obvious next probes, in
rough order of expected information: a task where the authorising fact sits in
background rather than in the instruction; a task with a genuinely ambiguous step where
stopping is defensible; and several samples per arm, since one run per arm cannot
separate a null effect from a coin that landed the same way twice.

The clause is kept because it costs seven lines, states something true about how the
roster is meant to work, and closes a real asymmetry in the written personas. It is
kept on that basis, not on a measured improvement, and this file exists so nobody
later mistakes one for the other.
