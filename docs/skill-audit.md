# Skill relevance audit

Forty-eight skill bundles ship with this plugin. Every one is reachable: a
bundle no expert declares can never load, because an expert's child sees exactly
the set its definition names. The audit below is therefore about *reachability*
first, and about whether each bundle earns its place second.

## Result

| Stage | Referenced | Bundles on disk |
| --- | --- | --- |
| Before the audit | 20 | 48 |
| After the audit | 42 | 48 |
| After the business-process addition | 43 | 49 |

Twenty-eight bundles were shipped but unreachable. Each is now either wired to
the expert whose mandate matches it, or recorded below as deliberately excluded.

Per-expert counts after the audit:

| Expert | Skills |
| --- | --- |
| discover | 5 |
| design | 7 |
| diagnose | 4 |
| plan | 8 |
| test | 5 |
| review | 6 |
| write | 10 |
| harness | 7 |
| delivery | 7 |

## Deliberately excluded

Six bundles stay on disk unreferenced. They are not oversights; wiring them would
make an expert worse.

| Bundle | Why it is not wired |
| --- | --- |
| `grill-me` | A 157-byte stub. `grilling` is the real skill (1987 bytes) and is carried by `plan`. |
| `grill-with-docs` | A 247-byte stub of the same thing. The documentation it promises is what `domain-modeling` and `to-spec` already produce. |
| `loop-me` | Not a general skill: it runs a grilling session aimed at *this plugin's* own workflow vocabulary. It belongs to developing this package, not to using it. |
| `migrate-to-shoehorn` | A one-library migration for `@total-typescript/shoehorn`. It is a codemod, not a discipline, and only applies to a repo already using that library. |
| `setup-matt-pocock-skills` | One-time scaffolding of an issue tracker, label vocabulary, and document layout. It configures a *different* skill collection for a user's repo; carrying it here would offer setup for skills this plugin does not ship. |
| `skill-router` | Depends on a `skills_search` tool from another plugin. Wiring it would hand an expert an instruction that fails in a clean install, which is worse than not offering it. |

## What changed in the roster

The audit surfaced four experts whose skill sets were thin relative to their
mandate:

- `plan` gained `triage`, `wizard`, and `to-questionnaire`: an issue queue is the
  same state machine as a decision map, and a plan that needs a human step or an
  unanswered decision needs a way to hand it over.
- `write` gained the harness prose skills plus `writing-beats` and `teach`, so it
  covers all three writing modes rather than two.
- `review` gained this repo's review standard, its simplification hunt, and the
  git guardrails.
- `harness` gained the `dsh-*` maintenance procedures, which are exactly its
  mandate and were previously unreachable.

## Added after the first audit

`process-discovery` is new, not ported: none of the eight reference repositories
covered business-process discovery, and no existing bundle did either. It is
written from the methodology at
[`jwilger/agent-skills`](https://github.com/jwilger/agent-skills) (event modeling:
discovery before design, and the rule that every read-model field traces to an
event) and
[`daemon-blockint-tech/Agentic-Enteprises-Skill`](https://github.com/daemon-blockint-tech/Agentic-Enteprises-Skill)
(business analysis: as-is and to-be mapping, gap classification, elicitation).

The two sources agree on the part that matters here: **map the process before
designing the system**, and treat a workaround as a requirement rather than as a
user failing to adopt. The skill's contribution is the classification of gaps into
redundancy, handoff, bottleneck, workaround, missing feedback, and control gap,
and the rule that a to-be proposal with no metric cannot be evaluated.

## Method

Reachability is checkable, so it is checked: every `ExpertSkill.id` must name a
directory under `assets/skills/`, and the reverse tells you what is unreachable.
Both directions are asserted in the UI test suite and reported by
`catalogPayload()`.
