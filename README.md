# dsh-expert-agents

Nine summonable domain experts and five workflow templates for DeepSeek
Harness, installed as a plugin.

A model calls `list_experts` to see who is available, `plan_workflow` to get the
stage chain for the work in front of it, and `summon_expert` to brief one expert
for one stage. The expert answers and stops; the parent session keeps the task,
the judgment, and the final answer. Which experts are available is a setting,
with a page in **Settings → Experts**.

## The roster

| Slug | Expert | Owns |
| --- | --- | --- |
| `discover` | Process Analyst | How a business process actually works: the as-is map, the gaps, and a measurable to-be |
| `design` | Design Architect | Module boundaries, domain language, decisions that are expensive to reverse |
| `diagnose` | Diagnostician | Hard bugs, performance regressions, research that explains surprising behaviour |
| `plan` | Spec Planner | Work too large or too foggy for one session: decision maps, specs, tickets |
| `test` | Test Engineer | The executable definition of done: test-first construction, tiers, covering checks |
| `review` | Reviewer | The pre-merge gate: two-axis review, simplification, prose that reads as a contract |
| `write` | Writer | Documentation and long-form prose: docs, skills, AGENTS.md, teaching material |
| `harness` | Harness Maintainer | The runtime: agent presets, Cordis compositions, plugins, where a capability belongs |
| `delivery` | Delivery Operator | Execution of a settled spec, handoff, and the retrospective |

Each expert carries only the skills its mandate names, four to ten of them, plus
a statement of what it hands off to whom. That boundary is the design: an expert
with no stated edge quietly does every neighbouring job too.

## Workflows

A chain of stages, each with an expert owner. The chain scales to the work,
because an extra stage is a cost rather than a virtue.

| Template | Stages | Use when |
| --- | --- | --- |
| `business` | map the process, find the gaps, propose the to-be, design, plan, verify | The request is a business outcome rather than a defined feature |
| `feature` | design, plan, plan review, implement, review, verify | The work spans sessions, crosses a module boundary, or reverses a decision |
| `bug` | diagnose, implement, verify | It starts from a failure rather than a feature |
| `small` | implement, verify | One task, one file, nothing reversed |
| `parallel` | decompose, fan out, integrate, verify | Independent subtasks that share no files |

`plan_workflow` takes no argument and returns the index with the rules for
choosing, or a template id and returns the full chain: each stage's owner, what
it must produce, the defect it exists to catch, and the four conditions that are
the only reasons to stop for a human. A stage whose owner is switched off in
settings is marked, so the orchestrator knows to re-enable it or do that stage
itself.

`business` is the widest entry point and the one to reach for when the request is
an outcome rather than a feature. Its first three stages all belong to the
Process Analyst, because they are one conversation; its verify stage asks whether
the metric moved rather than whether the code runs. A stage whose owner is switched off in
settings is marked, so the orchestrator knows to re-enable it or do that stage
itself.

The design rationale, and the research each stage traces to, is in
[`docs/workflow-research.md`](docs/workflow-research.md); the operational guide
is [`docs/workflow-templates.md`](docs/workflow-templates.md); the skill
reachability audit is [`docs/skill-audit.md`](docs/skill-audit.md).

## Install

A profile lives under **`$DSH_HOME/profiles`**, so `DSH_HOME` decides where this
lands. On a checkout-based install `DSH_HOME` is the checkout itself:

```sh
export DSH_HOME=/path/to/deepseek-harness
dsh plugin --profile web add /path/to/dsh-expert-agents
dsh --profile web --dump-config   # expect expert-agents and expert-agents-remote
```

Run `dsh plugin add` without `DSH_HOME` set and it installs into a different
profile than the one the launcher boots, which shows up as a plugin that
`dsh --dump-config` seems to see and a session never loads. Set it explicitly.

Restart DSH Web and hard-refresh the browser. The Settings page needs the mounted
Remote service, so a reload is required even though the Host half activates on
its own.

The plugin is installed by path. It is not published to npm, and it declares the
harness's own packages as **peer dependencies** rather than installing them:

```
@deepseek-ai/dsh-tools         >=0.1.6-alpha.1
@deepseek-ai/dsh-subagent      >=0.1.6-alpha.1
@deepseek-ai/dsh-typert-protocol, @deepseek-ai/schemastery, react …
```

That is deliberate. A plugin cannot own the harness it extends, and declaring
those as `dependencies` would install a second copy of `dsh-tools` beside the
running one — two registries, two service instances, and a plugin that mounts
without effect. Peers also turn a version mismatch into an install-time message
instead of a subtle incompatibility later.

Every peer except `react` is marked `optional`, so installing this package in a
bare checkout succeeds; the harness supplies them at runtime. `react` is
required, because the client half imports it and `react/jsx-runtime`
unconditionally.

Building or testing from a checkout of this repository therefore needs the
harness packages resolvable. Point npm at the versions you run, for example by
adding them to your own project, or work inside a DSH workspace where they
already resolve — see "Building from source" below.

## Use

Three tools are the whole model-facing surface.

`list_experts` takes an optional `slug`. With none it returns the roster; with
one it returns that expert's mandate, its skills and why it has each, and where it
hands work off.

`plan_workflow` takes an optional `workflow`. With none it returns the index of
templates and the rules for choosing between them; with an id it returns that
chain, stage by stage, with the entry gate and the stop conditions.

`summon_expert` takes `expert`, `task`, and an optional `context`. The expert does
**not** see the conversation, so `task` has to stand alone: the workspace, the
exact artifact or question, and what you want back. `context` is for what has
already been settled. The difference matters, because the two are labelled
differently in the child's prompt and an expert told to treat a decision as
already-made will not re-litigate it.

An expert cannot summon another expert. Two things enforce that: `maxDepth`
defaults to 1, so the child may not start a grandchild, and the persona tells it
so. The depth cap is the binding one.

Every persona is armed in two directions. The expert brief narrows *scope* — what the
expert owns and what it hands off — and a shared clause settles *authorisation*: the
task and its background are the child's mandate to proceed, so it does not stop to ask
for permission they already granted, and it does not ask the parent to confirm a step
that only carries out what was asked. The two are different, and before the shared
clause existed five of the nine personas stated a stopping boundary and none stated a
continuing one, leaving every expert able to over-stop. A specialist that halts on a
question its own brief answered costs the parent a round trip to repeat itself.

Two tests cover the clause: that every expert's composed persona states both
boundaries, and that a real summon hands that text to the subagent runtime. Neither
claims the clause changes how a child behaves.

That last part was measured separately, against a real model, and the result was
null: two summons differing only by the clause produced the same fix, the same
deferrals, and no blocking questions from either arm. The clause is kept because it
costs seven lines and closes a real asymmetry in the written personas, not because it
was shown to improve anything. See `docs/persona-clause-measurement.md` for the
method, the numbers, and what a stronger test would have to do.

## Configure

```yaml
# in the profile's composition, if the defaults do not fit
- id: expert-agents
  name: dsh-expert-agents
  config:
    provider: spawn   # the ctx.subagents provider to delegate through
    maxDepth: 1       # 1 means an expert cannot summon another expert
```

Enabled experts live in settings, not config, so the choice is revisioned and
survives a restart. Edit them in **Settings → Experts**, or by hand:

```yaml
# ~/.dsh/settings.yaml
expert-agents:
  enabled: [design, harness]
```

A fresh install enables all eight. Disabling all eight is allowed and is the way
to silence the roster without uninstalling it.

## Architecture

Three artifacts, because the runtime has three planes and mixing them is the
failure mode that produces a plugin which mounts and then does nothing.

| Artifact | Plane | What it does |
| --- | --- | --- |
| `lib/index.js` | Host | The catalog and the three tools |
| `lib/remote.js` | Host | The Remote service the Settings page reads and writes |
| `lib/client.js` | Browser | The Experts settings page |

`cordis.patch.yml` registers the Remote service as its **own top-level row**.
This is not stylistic. The api-gateway discovers Remote routes from the root
service table, so a Remote registration nested inside another plugin's scope is
invisible to it: the plugin mounts, the page renders, and every call from it
fails. Two rows is the fix.

Two data modules feed the Host half. `src/experts.ts` is the roster: personas,
mandates, skill sets, and hand-off routes. `src/workflows.ts` is the routing
table: which expert owns each stage of each chain. Both are plain data with no
runtime dependency, so the roster can be extended or a template adjusted by
editing one array, and the tests read the same values the tools publish.

`src/contract.ts` holds the invocation descriptors and the wire schemas, shared
by both halves. The Host registers them so the gateway can route calls; the client
mounts them so the `remote.expertAgents` namespace exists; identical ids are what
pair the two. A hand-copied second contract would let the ids drift, and the
symptom would be an unroutable call rather than a type error.

### React is a peer, never a dependency

The client bundle imports `react` and expects the shell's single instance. A
private copy produces two Reacts, and every hook call in the page then fails with
"Invalid hook call". The plugin therefore declares `react` as a peer and
`node_modules/react` links to the harness's own copy. This was found by running
the UI test, not by reading the bundle.

### Host packages resolve from the checkout, never from npm

`@deepseek-ai/*` packages are provided by the host at run time and are
unpublished. Installing them from npm produces a second copy whose nominal types
do not unify with the workspace's, so `tsconfig.json` maps each one to its
workspace declaration file, and `dependencies` points at the local checkout with
`link:` rather than a version range. `@deepseek-ai/schemastery` is a genuine
runtime import of the shared contract and the client bundle inlines it as a
vendored library, so unlike the rest it must be resolvable rather than merely
typed.

This means the package is **not installable from a clean npm registry**: it
resolves its host packages from a checkout that must exist at
`../../deepseek-harness` relative to this directory. That is deliberate while the
host packages are unpublished. Making it publishable means publishing them first
or declaring them as versioned peers.

### Subagent capabilities are checked, not assumed

A provider advertises which start-time options it supports, and the runtime
**rejects** a request naming one it lacks, with `UNSUPPORTED_CAPABILITY`. The
providers differ sharply: `spawn` and `fork-in-process` support everything, while
`codex` and `claude-code` advertise none of them.

`summon_expert` therefore reads `ctx.subagents.getProvider(provider).capabilities`
and sends `persona` and `maxDepth` only when they are supported. On a provider
without `persona` support the expert's brief is folded into the prompt instead,
because an expert without its brief is not that expert. On a provider without
`depthLimit`, the recursion cap is simply unavailable, and the persona's own
instruction is what stops an expert summoning another.

This was a real defect: sending both unconditionally crashed every summon on a
provider advertising neither. It was found by running the tool against a provider
that lacks them, not by reading the code.

## Building from source

```sh
pnpm install
npx tsc --noEmit -p tsconfig.json   # type-check
npx tsdown                          # emit lib/
```

`tsconfig.json` points at a checkout at `../../deepseek-harness`. Edit those
`paths` entries if the checkout lives elsewhere.

### Tests

The UI test lives in the harness checkout, because it drives the real slot
renderer:

```sh
cd /path/to/deepseek-harness
npx vitest run packages/experimental/expert-agents-ui/tests/
```

The suite resolves the plugin by package name, which needs a link at the checkout
root. `dsh plugin add` creates one and leaves it alone; `dsh plugin remove` prunes
it. If the suite reports the plugin as unresolvable after a removal, restore it:

```sh
ln -sfn /path/to/dsh-expert-agents node_modules/dsh-expert-agents
```

Nineteen cases across two files.

`expert-agents-ui.client.spec.ts` drives the real slot renderer: the roster
renders, the count is the enabled count rather than the roster length, disabling
writes through with the revision it read, a toggle sends the set in roster order,
a missing skill bundle is marked, and an unreachable service reports an error
instead of rendering as an empty roster.

`skills.client.spec.ts` reads the package directory: every declared bundle exists
on disk, every bundle on disk is reachable or listed as deliberately excluded
with a reason, no exclusion has gone stale in either direction, every frontmatter
parses and its `name` matches its directory, every workflow stage owner resolves
to a real expert, every stage states what it produces and what it catches, and
template and stage ids are unique, and the counts the documentation quotes match
the code. Each has been shown to fail on a seeded regression rather than only to
pass.

## Verification

Checked against the live runtime, not inferred.

- **Mounted.** `dsh --profile web --dump-config` shows both rows, and a real
  server boots with zero errors and the plugin installed.
- **The business chain routes.** `plan_workflow {business}` returns six stages
  through Process Analyst, Design Architect, Spec Planner, and Test Engineer, and
  the roster reads nine experts.
- **Tools register and behave.** All three tools register against the real
  `tools`, `subagents`, and `settings-file` services; the roster and a single
  expert both render; every declared skill resolves to a real bundle; the three
  failure paths (unknown slug, empty task, no agent in scope) return instructions
  rather than throwing.
- **Workflows route correctly.** Each chain names its owners, and a stage whose
  expert is switched off in settings is marked while an enabled one is not. This
  was checked both ways, with the namespace registered and with it absent.
- **Skills are reachable.** Every bundle on disk, forty-nine of them, is either
  declared by an expert or listed as deliberately excluded with a reason; every
  declared bundle exists; every frontmatter parses and its `name` matches its
  directory.
- **Delegation.** `summon_expert` calls `ctx.subagents.start(provider, request)`
  with the composed prompt, the expert's persona plus the child notice, and
  `maxDepth` from config. The child is disposed in a `finally`.
- **The Remote service.** `getState` defaults to all eight on a fresh install,
  `setEnabled` persists and reads back, unknown slugs are dropped, empty is
  allowed, and the revision travels with every write.
- **Delegation, against the real runtime.** A test mounts the production
  services, the real `spawn` provider, and a real parent Agent, then calls
  `summon_expert`. It asserts that a genuine child Agent appeared under the parent
  during the run and is gone afterwards, that the provider resolves with
  `inheritsParentContext: false`, and that every failure path returns text rather
  than throwing. The child's own turn fails here because no model route is
  configured, and that failure is correctly reported as text.
- **Capability gating, both ways.** Against a provider advertising `persona` and
  `depthLimit`, both are sent. Against one advertising neither, both are omitted
  and the brief is folded into the prompt. Before the fix the second case threw
  `UNSUPPORTED_CAPABILITY`.
- **Tests.** Twenty-nine pass: six UI tests against the real renderer, ten
  delegation tests against the real runtime, and thirteen shape-and-reachability
  tests over the bundles, the templates, and the counts the documentation
  states.
- **Types.** `tsc --noEmit` is clean across all three halves with no locally
  installed host packages.

### What is not verified

**No model has chosen to summon an expert.** Every layer beneath that choice is
now exercised: the tools register against the real services, the provider
resolves, and a real child Agent is constructed, briefed, and disposed. What
remains untested is the model's own decision to call `summon_expert` and its
ability to write a brief that stands alone, because that requires a configured
model route and none is available in this environment.

A subagent needs no credential of its own: it runs on whatever route the parent
agent already has. The credential is required only to put a model in the loop to
make the choice, which is precisely the part left unverified.

To close it: start a session, ask for a design decision on something
non-trivial, and see whether it reaches for `summon_expert` unprompted, and
whether the brief it writes is self-contained.

## Trust

A plugin is exactly as privileged as the code it runs, and this one registers
tools that spawn agents and reads files from its own package directory. Installing
it is equivalent to installing any other plugin that delegates. The experts are a
*scoping* device, not a sandbox: they narrow what a child is asked to do, not what
it is able to do.
