# Workflow design: what the research says

This document is the evidence base for the workflow templates. Every stage and
every gate in the templates traces to a finding below. Where a finding is a
matter of engineering judgment rather than published result, it says so.

## Sources

Primary, read in full or in the relevant part:

- Anthropic, [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system),
  June 2025. The orchestrator/worker architecture and its cost profile.
- [`obra/superpowers`](https://github.com/obra/superpowers). Fourteen workflow
  skills, including `subagent-driven-development`, `writing-plans`,
  `verification-before-completion`, `dispatching-parallel-agents`,
  `systematic-debugging`, and the two code-review skills.
- Anthropic's public [skills repository](https://github.com/anthropics/skills),
  for skill structure and the `skill-creator` conventions.
- [`jwilger/agent-skills`](https://github.com/jwilger/agent-skills), the
  `event-modeling` skill: Martin Dilger's methodology, and the two-phase rule
  that discovery precedes design.
- [`daemon-blockint-tech/Agentic-Enteprises-Skill`](https://github.com/daemon-blockint-tech/Agentic-Enteprises-Skill),
  the `business-analyst` skill: elicitation, as-is/to-be mapping, gap analysis.
- [Dual-track discovery and delivery](https://usersnap.com/blog/dual-track-agile-ant-murphy/),
  on why the two run continuously rather than as a phase gate.
- Domain packs, surveyed and deliberately not carried: [Vercel](https://github.com/vercel-labs/agent-skills)
  (React, Next, deployment), [Supabase](https://github.com/supabase/agent-skills)
  (Postgres), [Ultralytics](https://github.com/ultralytics/skills) (YOLO, CV),
  [RAG skills](https://github.com/Goodnight77/rag-skills) (retrieval, chunking,
  evaluation), [taste](https://github.com/Leonxlnx/taste-skill) (frontend
  aesthetics), [RigorPilot](https://github.com/lllllllama/RigorPilot-Skills)
  (research reproduction). See the note below on why these are not bundled.

### Why the domain packs are not carried

Six of the eight repositories were surveyed and their skills deliberately left
out. The distinction is between a **discipline** and a **reference**.

A discipline is a way of working that stays true across projects: map the process
before designing, find the root cause before fixing, get fresh evidence before
claiming. The eight experts carry disciplines, which is why their skills stay
valid as the stack changes.

The domain packs are references, and they drift:

| Pack | What it actually is |
| --- | --- |
| Vercel | 70 numbered React and Next.js performance rules, plus CLI and deploy procedures |
| Supabase | A protocol that says "do not trust your training data, fetch the changelog first" |
| Ultralytics | YOLO training, export, and dataset procedures tied to one library |
| RAG skills | Chunking, retrieval, and evaluation techniques tied to a vector store |
| taste | Aesthetic direction: brutalism, minimalism, soft, brandkit |
| RigorPilot | Research-reproduction procedures for one workflow |

Bundling them would be actively harmful, not merely redundant. A pinned copy of a
70-rule performance guide is wrong within a release or two, and the plugin would
be presenting stale API advice with the same authority as a discipline that does
not expire. The Supabase pack is the clearest case: its own first principle is
that its contents must not be used from memory, which a bundled skill cannot
honour.

**What to do instead.** These belong in the user's own skill root, where they can
be updated on their own cadence, and where the version that loads matches the
version being deployed. An expert's skill set is for what stays true; a
technology reference is for what the project pins.

## Findings that shape the templates

### 1. Multi-agent pays for breadth, not for depth

Anthropic's measurement: a lead agent with subagents outperformed a single agent
by 90.2% on a breadth-first research eval, exactly the case where many
independent directions are explored at once. The same system is
**token-hungry**; their own framing is that the architecture costs several times
a single agent's tokens for the work it does.

**Consequence for us.** A workflow is not free, and the number of stages is a
cost, not a virtue. The templates therefore scale the chain to the work: a small
change runs a three-stage chain, not a seven-stage one. A stage earns its place
by catching a class of defect the previous stage cannot see, not by existing.

### 2. Verification must be a separate act from production

Superpowers states this as an iron law: "no completion claims without fresh
verification evidence." The gate is procedural: identify the command, run it
fresh, read the full output, and only then claim. The rule exists because the
failure it prevents is not ignorance but self-assessment drift: an agent that
just wrote the code is the worst judge of whether it works.

**Consequence for us.** The verifier must run the command in a context that did
not produce the artifact. In this roster that means a separate summoned expert
with a tool filter that lets it execute and read but not author the change, and a
verifier that reports the raw evidence rather than a verdict.

### 3. A reviewer without the author's reasoning is the point

Superpowers' `requesting-code-review` says the reviewer "gets precisely crafted
context for evaluation, never your session's history." Its
`receiving-code-review` adds the mirror rule: verify before implementing, ask
before assuming, do not perform compliance.

**Consequence for us.** The review stage receives the artifact and the spec, not
the implementer's narrative. This is why every expert child is a fresh subagent
with a constructed prompt: inheriting the parent's history would carry the
author's justifications into the review, which is precisely the bias the stage
exists to remove.

### 4. Planning is a separate artifact with its own reviewer

Superpowers' `writing-plans` insists the plan be written for an engineer with
"zero context for our codebase and questionable taste," naming files, tests, and
how to run them per bite-sized task. Their `subagent-driven-development` adds a
task review after *each* task plus a broad review at the end, and a standing rule
that the running plan does not stop for the human: ambiguities are ruled on and
recorded, not escalated, except for four named irreversible or outward-facing
cases.

**Consequence for us.** The planner produces a file, not a conversation, because
the executor is a different agent with a different context. The plan gets its own
review because a plan defect costs one revision, while the same defect discovered
in implementation costs the implementation. And the orchestrator needs an explicit
stop list, or it will either stall constantly or act destructively unattended.

### 5. Parallelism requires independence, and independence must be checked

Superpowers' `dispatching-parallel-agents` gives the test as a decision: multiple
failures, are they independent, can they run concurrently. Related failures, or
any shared state, mean sequential dispatch.

**Consequence for us.** Parallel stages appear only in the template for work
whose tasks share no files. A template that fans out over a shared workspace
produces conflicting edits, and the cost of merging them exceeds the time saved.

### 6. Debugging is a distinct discipline from fixing

Superpowers' `systematic-debugging` states the rule flatly: "always find root
cause before attempting fixes. Symptom fixes are failure."

**Consequence for us.** Diagnosis is its own template entry point, not a step
inside implementation. A bug that arrives at the implementation stage without a
mechanism is a bug that gets a symptom fix.

### 7. A business outcome is not a defined feature, and needs its own entry point

Every source above assumes a settled requirement and asks how to execute it.
None covers the case the request arrives as an outcome: a metric to move, a
complaint, a regulation to satisfy.

Both business-facing sources converge on the same first move. Event modeling
splits into **domain discovery then workflow design**, with an explicit rule:
"never jump into detailed workflow design without broad domain understanding
first." Business analysis splits into **as-is mapping then to-be design**, with
elicitation before both. The dual-track literature adds the reason this cannot be
folded into planning: discovery and delivery run continuously and answer different
questions, so a delivery plan written against an un-discovered process plans the
wrong work at speed.

They also agree on the most useful single heuristic: **a workaround is a
requirement, not a user failing to adopt.** The spreadsheet beside the system of
record exists because the system does not match the process, and it is the
cheapest available evidence of what the process actually is.

**Consequence for us.** Business process is a fifth template and its own entry
point, not a prefix on `feature`. Its first three stages all belong to the
Process Analyst, because they are one conversation and splitting them across
agents would carry the map's context away from the person still building it. Its
verify stage is deliberately different from the other chains: it asks whether the
metric moved, not whether the code runs, because a system that ships exactly as
specified and changes nothing is the failure this chain exists to prevent.

### What the business sources do not settle

Neither source says when discovery is *done*, and both are advisory rather than
enforcing. The template adopts explicit validation criteria in the skill (every
step has an actor, a trigger, and an output; every finding cites its evidence;
every proposal names a metric) rather than pretending there is a measurement that
settles it.

## The stage chain, and why each stage exists

The objective names the chain as orchestrator, planner, planner review,
implementer, review, audit. That chain is defensible, and each link traces to a
finding above.

| Stage | Catches | Evidence |
| --- | --- | --- |
| Orchestrator | Nothing directly. It routes, sequences, and rules | Finding 4: the running plan must not stall on the human |
| Planner | Misunderstanding, before any code exists | Finding 4: a plan defect costs one revision |
| Planner review | A plan that cannot be executed by someone without your context | Finding 4: written for "zero context" |
| Implementer | Nothing. It produces | Finding 1: production needs no gate of its own |
| Review | Author bias, spec drift, unstated assumptions | Finding 3: the reviewer must lack the author's reasoning |
| Audit / verify | Claims that do not match reality | Finding 2: fresh evidence, separate context |

Two additions to the named chain, both from the evidence:

- **A design or spec stage before planning** for work whose difficulty is
  undecided requirements rather than undecided steps. Findings 3 and 4 both
  assume a settled spec exists; when it does not, planning is premature.
- **A diagnosis entry point** for work that starts from a failure rather than a
  feature. Finding 6.

## Where the chain is shortened, and why

Findings 1 and 5 say the stage count is a cost. The templates therefore define
four chains rather than one:

1. **Feature** (the full named chain): design, plan, plan review, implement,
   review, verify. Justified when the work spans sessions or crosses module
   boundaries.
2. **Bug** (diagnose, then implement, verify): justified by finding 6. Planning a
   fix before the mechanism is known plans the wrong fix.
3. **Small change** (implement, verify): one task, one file, reversing nothing.
   Justified by finding 1: the chain would cost more than the change.
4. **Parallel** (decompose, fan out, integrate, verify): justified by finding 5,
   and only when the subtasks share no files.

## What the research does not settle

Two things are engineering judgment here rather than published result, and are
marked as such in the templates:

- **Where the audit stage ends.** The evidence establishes that verification must
  be independent, not how many independent checks are enough. The templates use
  one verify stage and add the review stage's second axis rather than multiplying
  stages.
- **How the orchestrator rules.** Superpowers' "rulings, not stalls" rule is
  practice, not measurement. The templates adopt it and adopt their four stop
  conditions, because the failure it prevents, a session parked on a question
  while the work is reversible, is clearly worse than the rework.
