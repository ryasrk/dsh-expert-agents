# Workflow templates

Four chains. Pick by the shape of the work, not by how important it feels; the
chain you pick decides how many agents you pay for.

| Template | Chain | Use when |
| --- | --- | --- |
| `business` | map the process → find the gaps → propose the to-be → design → plan → verify | The request is a business outcome, not a defined feature |
| `feature` | design → plan → plan review → implement → review → verify | The work spans sessions, crosses a module boundary, or reverses a decision |
| `bug` | diagnose → implement → verify | It starts from a failure, not a feature |
| `small` | implement → verify | One task, one file, nothing reversed |
| `parallel` | decompose → fan out (n) → integrate → verify | Independent subtasks that share no files |

Every stage names the expert that owns it. An expert that does not appear in a
chain is not part of that chain, which is the point: a chain nobody can shorten
is a chain that runs at full cost on trivial work.

## business

```
orchestrator (you)
  └─ map the process   Process Analyst    the as-is map, in the business vocabulary
  └─ find the gaps     Process Analyst    classified and evidenced
  └─ propose the to-be Process Analyst    one proposal per gap, each with its metric
  └─ design            Design Architect   the boundary and the decisions this implies
  └─ plan              Spec Planner       slices into executable work
  └─ verify            Test Engineer      evidence the metric moved, not just that it runs
```

**This is the widest entry point, and the one to reach for when the request is a
business outcome** ("approvals are slow", "we need an approval flow") rather than
a feature. Every other template assumes a decision this one exists to produce.

**Entry gate.** The outcome can be stated as something measurable. If it cannot,
that is the first finding rather than a blocker: a process mapped against an
unmeasurable goal produces a model nobody can evaluate.

**The as-is map is the deliverable that matters.** The requester describes the
process they believe runs, or the one they wish ran. The workarounds, the
spreadsheet beside the system, the side channel, describe the one that does. Ask
"and then what happens?" at every step and follow every answer; the step after
the one you were told about is where the map diverges.

**Prefer removing a step to automating it.** An automated step that should not
exist is worse than a manual one, because it now runs faster and produces more.

**Verify means the metric moved**, not that the code runs. A system that ships
exactly as specified and does not change the outcome is the failure this whole
chain exists to prevent.

## feature

```
orchestrator (you)
  └─ design       Design Architect     only when the requirements are unsettled
  └─ plan         Spec Planner         produces a plan file
  └─ plan review  Reviewer             a plan an outsider cannot execute is a plan defect
  └─ implement    (you, or an implementer)   per task, not per plan
  └─ review       Reviewer             artifact plus spec, never the author's reasoning
  └─ verify       Test Engineer        runs the commands, reports raw evidence
```

**Entry gate.** A settled spec exists. If the difficulty is undecided
*requirements* rather than undecided steps, run `design` first; planning against
unsettled requirements plans the wrong thing.

**Plan review is not optional.** A plan defect costs one revision. The same defect
found during implementation costs the implementation. This is the cheapest gate
in the chain.

**Review gets the artifact and the spec, not the implementer's narrative.** The
reviewer must lack the author's reasoning, or it inherits the author's
justifications and approves them.

**Stop conditions.** Only four, and only these: an irreversible or destructive
operation; a security-sensitive action; a side effect outside the workspace that
norms say you ask about first (a push to a shared branch, a publish, a merge); or
a plan so broken that every path forward is a guess. Everything else you rule on
and record.

## bug

```
orchestrator (you)
  └─ diagnose     Diagnostician       finds the mechanism, not the symptom
  └─ implement    (you, or an implementer)
  └─ verify       Test Engineer
```

**Do not plan before diagnosing.** A fix planned without the mechanism is a fix
planned for the wrong defect. The diagnose stage ends with a stated mechanism and
a failing check that reproduces it; that check becomes the verification.

**Symptom fixes are failure.** If the diagnosis cannot name *why* the defect
occurs, the stage is not done, however plausible the candidate fix looks.

## small

```
orchestrator (you)
  └─ implement
  └─ verify
```

**Entry gate.** All three must hold: one file or one cohesive edit; nothing
reversed; the change is explainable in a sentence. If any fails, use `feature`.

**Still verify.** The shortened chain drops the planning and review stages, not
the evidence requirement. Run the check and read the output before claiming.

## parallel

```
orchestrator (you)
  └─ decompose               group by what is broken, not by file touched
  └─ fan out (n experts)     one per independent domain, dispatched together
  └─ integrate               you merge and resolve
  └─ verify                  Test Engineer
```

**Independence is the entry gate, and it must be checked, not assumed.** The test:
can each subtask be understood without any other's context, and can the two run
without touching the same files? Two failures with one root cause are *related*;
fix one and the other disappears, and running them in parallel burns a second
agent to rediscover the first one's finding.

**Shared state means sequential.** A template that fans out over one workspace
produces conflicting edits, and merging them costs more than the parallelism
saved.

**Each dispatched expert gets a self-contained brief**, because it does not
inherit your context. Name the scope, the goal, the constraint, and the expected
return.

## Choosing between them

Ask what is actually undecided:

- The process itself undecided → `business`.
- Requirements undecided → `feature`, starting at design.
- Mechanism undecided → `bug`.
- Steps undecided only → `feature`, starting at plan.
- Nothing undecided → `small`.
- Several of the above, independently → `parallel`.

Note the ordering: business work is not a special case of feature work. It is the
case where the requirements do not exist yet, and mapping the process is what
produces them.

The common failure is reaching for `feature` because the work feels important. If
the requirements, the mechanism, and the steps are all settled, importance does
not make the extra stages catch anything.
