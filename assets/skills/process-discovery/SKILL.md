---
name: process-discovery
description: Map how a business process actually works before deciding what to build. Use when the request is a business outcome rather than a defined feature, when the words used do not match a process you can name, or when asked to discover, map, model, or redesign how work happens. Produces an as-is map, the gaps, and a to-be proposal.
---

# Process Discovery

## Overview

Software is a means to a business end. When a request arrives as an outcome
("reduce order errors", "we need an approval flow", "customers keep complaining
about X"), there is a process behind it that nobody has written down, and the
details only exist in the heads of the people doing the work.

**Core principle: map what happens before you decide what to build.** A system
built against the request as stated encodes the requester's mental model, which
is almost never the process. The most expensive defects are not bugs; they are
features that faithfully implement a process that was never how the work got
done.

This skill produces three artifacts and stops. It does not choose technology,
databases, or frameworks.

## The four phases

Run them in order. Do not skip to phase 3 because you think you already know.

### Phase 1: Frame the outcome

Answer, in business language:

- **What outcome does the business want, and how is it measured today?** A
  metric, not a feeling. "Time to approve an invoice: 4 days" is frameable;
  "approvals are slow" is not.
- **Who carries the pain?** The person who feels the problem is often not the
  person who requested the change.
- **What is the boundary?** Which process, which teams, which systems. An
  unbounded discovery never ends.
- **What triggered this now?** A regulation, a growth threshold, a lost customer.
  The trigger tells you which constraint is real.

If the outcome cannot be stated as something measurable, stop and ask. A
discovery run against an unmeasurable goal produces a model nobody can evaluate.

### Phase 2: Map the as-is process

This is the phase that pays for the whole exercise. Map what happens, not what
the process document says or what the requester believes.

For each step, capture:

| Field | What to record |
| --- | --- |
| Actor | The role that performs it, named as the organisation names it |
| Trigger | What causes this step to start |
| Input | What it consumes, and where that came from |
| Action | What is actually done, including the manual parts |
| Output | What it produces, and who receives it |
| Time | How long it takes, and whether that is work time or waiting time |
| Failure | What happens when it goes wrong, and who notices |

Then walk the map and ask, at every single step: **"and then what happens?"**
Follow every answer. The step after the one the requester described is where the
real process usually diverges from the described one.

**Ask about the workarounds specifically.** The spreadsheet beside the system,
the side channel, the person who re-checks every entry. A workaround is not a
user failing to use the system; it is the system failing to match the process.
Every workaround is a requirement nobody has written down yet.

**Ask "can there be more than one of these at once?"** of every piece of state.
A process where one order is open is a different design from one where five are,
and the difference is invisible until someone tries to represent it.

### Phase 3: Find the gaps

Walk the as-is map and classify each finding:

- **Redundancy:** the same data entered twice, the same check performed by two
  roles. Evidence: two steps with the same output.
- **Handoff:** work passes between actors or systems. Each handoff is a queue and
  a place information is lost. Count them; the count is a defect signal.
- **Bottleneck:** the step where work waits. Compare work time to waiting time.
  A step that takes 10 minutes of work but 3 days of waiting is the bottleneck,
  and it is a queueing problem, not a speed problem.
- **Workaround:** anything outside the system of record. Each one is a hidden
  requirement.
- **Missing feedback:** a step whose failure nobody detects until much later.
- **Control gap:** a decision with no record of who made it or why, which is what
  an audit will ask for.

### Phase 4: Propose the to-be

For each gap, propose a change, and state the **measurable** change it produces.
"Automate the approval step, reducing the wait from 3 days to 4 hours" is a
proposal. "Improve the approval flow" is not.

Prefer eliminating a step to automating it. An automated step that should not
exist is worse than a manual one, because it now runs faster and produces more.

Then state plainly:

- **What stays manual, and why.** Some steps involve judgment, physical presence,
  or accountability that a system cannot hold. Naming them prevents the proposal
  from reading as "automate everything".
- **What must be true before this works.** A dependency on a process change, a
  data cleanup, or a decision someone has not made.
- **What this does not fix.** The scope boundary, restated against the findings.

## Output

Write the artifacts to `docs/process/<process-name>/`:

- `as-is.md`: the phase 2 map, one section per step, with the table above.
- `gaps.md`: the phase 3 findings, each classified and evidenced.
- `to-be.md`: the phase 4 proposal, each change with its metric and its cost.

Keep the language the business uses, not what you would name things in code. If
the organisation says "job card", write "job card", even if you would call it an
order. Renaming things is a phase 6 problem for whoever builds it, and doing it
here loses the people who can confirm the map.

## Validation

Before handing off, check:

- Every step has an actor, a trigger, and an output. A step missing any of the
  three is a step you have not finished mapping.
- Every gap finding cites the step or steps that evidence it.
- Every to-be proposal names a metric it moves.
- The manual steps that remain are named explicitly.
- The map uses the business's own vocabulary throughout.

## Handoff

This skill ends with a mapped process, not a system. It hands off to:

- **domain modeling** when the process names concepts the codebase must share.
- **planning** once the to-be is agreed, to slice it into executable work.
- **design** when the to-be implies a boundary or data-shape decision.

Do not begin implementation from this skill's output directly. A to-be proposal
that has not been through planning has an unfixed scope and a metric nobody has
agreed to.

## Anti-patterns

- **Interviewing only the requester.** They know the process they wish existed.
- **Mapping the documented process.** The document describes the intended
  process; the workaround describes the actual one.
- **Jumping to a solution in phase 2.** Once you are proposing a system, you stop
  asking "and then what happens?", and that question is where the value is.
- **Treating the bottleneck as a speed problem.** Work waiting in a queue is not
  fixed by making the work faster.
- **A to-be with no metric.** It cannot be evaluated, so it cannot be rejected,
  so it will be built.
