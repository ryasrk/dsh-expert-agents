# Cognitive layer audit: what DSH already has, and what is missing

This audit maps the packages that exist in this checkout against nine
cognition-relevant layers, so that new work patches real gaps instead of
duplicating a package that already ships.

Every claim below was checked against the package's own README or source, not
inferred from a directory name. Directory names are unreliable here: `guard/`
holds loop hygiene, not safety enforcement, and `feedback/` holds an audit log,
not a learning loop.

## Verdict

| Layer | Status | Closest packages |
| --- | --- | --- |
| 1. Cognitive core | partial | `goal`, `goal-round-driver`, `plan-mode`, `tool-todo`, `agent-loop` |
| 2. Memory | **missing** | `session-query`, `tool-session-query`, `spill`, `compaction` |
| 3. Knowledge | partial | `web/tool-web`, `context/agent-instructions`, `skill` |
| 4. Skills | implemented | `skill`, `skill-filesystem`, `tool-skill`, `skill-badge` |
| 5. Tools | implemented, strongest area | `fs`, `shell`, `terminal`, `lsp`, `web`, `mcp`, `browser-use`, `computer-use`, `ptc-runtime`, `e2b` |
| 6. Multi-agent | implemented | `subagent`, `workflow`, `tool-ralph`, `experimental/agent-team` |
| 7. Learning | **missing** | `feedback/message-feedback` (log-only) |
| 8. Evaluation | partial | `test-support/*`, `benchmarks/*` (both developer-facing) |
| 9. Autonomy | implemented | `goal`, `goal-round-driver`, `schedule`, `jobs` |

The short version: DSH is a mature tool-use shell and multi-agent orchestrator
with a durable goal and continuation loop, and it has essentially no memory, no
reflection, and no learning. The three layers most associated with sustained
autonomy are missing, partially missing, or outsourced.

## Layer by layer

### 1. Cognitive core — partial

Present:

- `goal/goal` — one persisted long-running objective per session, surviving
  resume, fork, and restart.
- `goal/goal-round-driver` — automatic continuation while active, armed, and
  within the round allowance.
- `plan/plan-mode` — explore and design before executing, then present the plan
  for approval.
- `todo/tool-todo` — a model-visible task list.
- `core/agent-loop` — the turn and step machinery.

Missing: **reflection**. No package asks the agent to evaluate its own output
before or after producing it. `plan-mode` shapes what happens *before* work;
nothing examines work *after* it.

### 2. Memory — missing

There is no memory package. No directory or package name contains `memor`,
`recall`, `retriev`, `embed`, or `vector`.

Memory is instead delegated to third-party MCP servers, documented in
`docs/user/guide/mcp-memory.md` (Memorix, `@modelcontextprotocol/server-memory`,
Engram). All are default-off, installed by a user-supplied `--patch` overlay, and
the document states plainly that the configurations "are provided as
interoperability examples only. Their inclusion does not imply endorsement,
recommendation, partnership, or ongoing support by DeepSeek."

What exists is adjacent but is not memory:

- `session-query/session-query` — list, filter, read, and search session history,
  with ranked full-text search via `session-query-sqlite`. This is a genuine
  substrate: the data is already durable and searchable.
- `session-query/tool-session-query` — five read-only tools exposing a subset of
  that to the model. **Not mounted in the web profile**, so the model cannot
  reach it today.
- `compaction/*` — condenses the *current* session's older history. This shortens
  context; it does not retain anything across sessions.
- `spill/*` — offloads oversized text to a session-scoped file.

The gap is not storage. It is that nothing decides what is worth keeping, writes
it down in a form that outlives the session, and brings it back when it is
relevant. `tool-session-query` retrieves raw past events on demand; it does not
distil them into durable knowledge, and it is off.

### 3. Knowledge — partial

Live retrieval exists (`web/tool-web`: search and fetch). There is no RAG, no
knowledge graph, and no embedding or vector index anywhere in the tree. Static
knowledge arrives only through instruction files
(`context/agent-instructions` reads `AGENTS.md` chains) and skill bundles.

### 4. Skills — implemented

`skill`, `skill-filesystem`, `tool-skill`, and `skill-badge` provide discovery,
loading, and model-facing invocation. This layer needs nothing.

### 5. Tools — implemented, and the strongest area

`fs`, `shell` (bash and pwsh, plus persistent variants), `terminal`, `lsp`,
`web`, `mcp`, `browser-use` (Playwright, Stagehand, Chrome DevTools), and
`computer-use` via the Cua driver, along with `ptc-runtime` (in-process Python)
and `e2b` (remote sandbox). Nothing here is a gap.

### 6. Multi-agent — implemented

`subagent` plus its providers, `tool-subagent`, `tool-subagent-control`,
`workflow` and `tool-workflow`, `tool-ralph`, and `experimental/agent-team`
(a durable roster, mailbox, and shared task board over continuable subagents).
Delegation, scoping, and role separation all work.

### 7. Learning — missing

No package adapts behavior across sessions. Searching the tree for
`self-improve`, `experience.replay`, or `lessons.learned` returns nothing.

The one package that sounds like it belongs here does not.
`feedback/message-feedback` records positive or negative ratings with an optional
category and notes — and states that it is "log-only and does not enter model
history." The signal is captured and then withheld from the agent that would act
on it. A human can read it; the model never sees it.

### 8. Evaluation — partial

There is no package that evaluates the agent's own work.

- `benchmarks/` measures runtime performance (latency, stream reconnect,
  continuation, long-session browser), not capability.
- `test-support/*` is developer test infrastructure: `llm-mock-server`,
  `llm-replay`, `agent-loop-testkit`, `session-snapshot`.
- `guard/repeat-tool-reminder` nudges the model out of identical tool loops, but
  is explicitly "advisory: it never blocks or delays a legitimate repeated call."
- `experimental/auto-review` is the closest neighbour by name and is something
  else entirely: a per-tool-call *authorization* gate that parses a risk
  classification to allow or deny a call before it executes. It judges whether an
  action is *permitted*, never whether output is *correct*.

So no mechanism checks a completion claim against evidence. An agent can declare
success on the strength of its own assertion.

Two shipped packages document this gap in their own defects lists, which is
stronger evidence than an absence of matches:

- `workflow/tool-ralph` — "those reports are not independently verified."
- `goal/goal-round-driver` — "**No independent evaluator** — the model-facing goal
  policy decides when evidence is sufficient for completion and whether a blocker
  is semantically unchanged; evaluator-backed certification remains deferred."

The second is the sharpest statement of the problem in the repository: the harness
that drives autonomous continuation has no evaluator, and its own documentation
says so. The model decides when its evidence is sufficient, which is the same thing
as deciding that it is done because it says it is.

### 9. Autonomy — implemented

`goal` provides the durable objective, `goal-round-driver` the continuation,
`schedule` the timing, `jobs` the background execution. Two bounds are worth
recording because they shape what any add-on can promise:

- `maxGoalRounds` defaults to 256 (`goal/src/index.ts`), and `tool-goal` stops
  continuation after the same block reason recurs for three consecutive rounds.
- Continuation permission is **process-local and never persisted**; the goal
  README notes that activation is never persisted and every agent-create edge
  disarms it. A restart therefore preserves the objective but not the standing
  permission to pursue it unattended.

## The gaps

Each entry names the gap, why it matters for sustained autonomy, and the nearest
existing package to build on rather than beside.

### Gap 1 — Nothing decides what is worth remembering

Why it matters: every session starts from nothing. A lesson learned about a
repository, a convention, a failure mode, or a preference is discarded when the
session ends, so the agent's competence does not compound. This is the single
largest structural difference between a long-running agent and a series of fresh
ones.

Nearest neighbour: `session-query` already stores and full-text searches
everything; `spill` already knows how to persist session-scoped artifacts. What
is absent is the *decision* about significance and a durable store keyed by what
makes something worth recalling.

### Gap 2 — Nothing reflects on output

Why it matters: an agent that cannot judge its own work cannot improve it
deliberately. Errors are caught only when an external check (a test, a compiler,
a human) happens to catch them.

Nearest neighbour: `plan-mode` for the shape of a reviewable artifact;
`subagent` for a second, independent context in which to do the critique.
`experimental/auto-review` shows how to intercept a call, but gates permission
rather than quality.

### Gap 3 — Verification is optional

Why it matters: an unverified completion claim is indistinguishable from a
verified one in the conversation, so a reader cannot tell them apart. The
failure is silent.

Nearest neighbour: `tool-todo` for a tracked statement of intended work;
`subagent` for an independent verifier; `agent-loop`'s turn machinery for the
point at which a claim is finalized.

### Gap 4 — Feedback never reaches the model

Why it matters: ratings are collected and then withheld from the only consumer
that could act on them. The cost of collecting them is paid and the benefit is
not.

Nearest neighbour: `feedback/message-feedback` already owns the record and
exposes it programmatically; nothing reads it back into a later request.

### Gap 5 — The memory substrate exists but is not exposed

Why it matters: `session-query-sqlite` is mounted and indexing, while
`tool-session-query` is not in the profile. Capability that is paid for is
unavailable.

Nearest neighbour: `session-query/tool-session-query`, which is written, tested,
and merely unmounted.

## What this means for the next step

Gaps 1, 2, and 3 are the same problem seen from three angles: the agent has no
durable record of what it learned, no settled view of what went wrong, and no
obligation to check. They are naturally one plugin rather than three, because a
reflection that is not remembered is wasted and a memory that records unverified
claims records noise.

Gap 4 is a small, self-contained fix. Gap 5 is a configuration change.

The audit therefore suggests building one cognitive-kernel plugin that owns the
loop — remember, reflect, verify, and carry forward — rather than a set of
features, and treating gaps 4 and 5 as cheap wins to take while it is built.
