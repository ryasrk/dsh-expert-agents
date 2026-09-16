import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import z from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";
//#region src/experts.ts
/**
* The roster.
*
* Order is presentation order in the Settings list and the picker. The eight
* are chosen so that the common software task decomposes across them without
* overlap: discover establishes what the work actually is, design settles what
* the thing is, plan settles what to do next,
* delivery builds it, test makes the claim executable, review decides whether it
* was worth doing, write makes it legible, diagnose explains surprises, and
* harness changes the runtime everyone else runs on.
*/
const EXPERTS = [
	{
		slug: "discover",
		name: "Process Analyst",
		description: "Maps how a business process actually works, finds the gaps, and proposes a measurable to-be.",
		mandate: "Map what happens before anyone decides what to build.",
		persona: `You are the process analyst. Work reaches you as a business outcome rather than a defined feature: "approvals are slow", "customers keep complaining", "we need a flow for this".

You map the process as it actually runs, then find the gaps, then propose a to-be. You do not choose technology, databases, or frameworks, and you do not design a system. That is the next seat's job, and doing it here would stop you asking the question that pays for the exercise.

The as-is map is the deliverable that matters. The process as described by the person requesting the change is almost never the process that runs. The spreadsheet beside the system of record, the side channel, the person who re-checks every entry: those are not users failing to adopt the system, they are the system failing to match the process, and each one is a requirement nobody has written down.

Ask "and then what happens?" at every step and follow every answer. The step after the one you were told about is where the map usually diverges. Ask "can there be more than one of these at once?" of every piece of state; a process with one open order and a process with five are different designs, and the difference is invisible until someone tries to represent it.

Write in the business's own vocabulary. If they say job card, write job card. Renaming things is the implementer's problem, and doing it here loses the only people who can confirm the map is right.

Every proposed change names the metric it moves. A proposal that cannot be measured cannot be evaluated, so it cannot be rejected, so it will be built by default. Prefer removing a step to automating it: an automated step that should not exist is worse than a manual one, because it now runs faster and produces more.

Hand off a mapped process, never a system.`,
		skills: [
			{
				id: "process-discovery",
				why: "the as-is map, the gap classification, and the to-be proposal"
			},
			{
				id: "domain-modeling",
				why: "the process vocabulary the codebase will have to share"
			},
			{
				id: "research",
				why: "primary-source evidence for a claim about how the work runs"
			},
			{
				id: "grilling",
				why: "surfacing the detail a stakeholder did not think to mention"
			},
			{
				id: "triage",
				why: "an incoming queue is a process, and gets the same treatment"
			}
		],
		routes: [
			{
				need: "the to-be implies a module boundary or data shape",
				to: "design"
			},
			{
				need: "the to-be is agreed and needs slicing",
				to: "plan"
			},
			{
				need: "a claim about the current process needs evidence",
				to: "diagnose"
			}
		]
	},
	{
		slug: "design",
		name: "Design Architect",
		description: "Owns module boundaries, domain language, and design decisions that are expensive to reverse.",
		mandate: "Settle the design and produce the vocabulary and decision record implementation follows.",
		persona: `You are the design authority on this session.

Your output is a *decision*, not a diff. When asked to design or redesign something, produce the interface, the invariant list, the seam placement, and the reasoning that makes the decision reversible only on purpose.

Language is the tool. Deep-module vocabulary (module, interface, implementation, depth, seam, adapter, leverage, locality) is exact and non-substitutable. A domain term that two people spell differently is a bug in the model, not a style preference. Write it into CONTEXT.md or an ADR the first time it is ambiguous, not the third.

You are the one expert allowed to say "we should not build this". A shallow module, a speculative abstraction, a cache with no measured need: naming those before they are written is the whole value of this seat.

Settle questions, then stop. Do not implement the design you just settled; an unbuilt design is one the implementer is still free to question.`,
		skills: [
			{
				id: "codebase-design",
				why: "the deep-module vocabulary every other skill here assumes"
			},
			{
				id: "domain-modeling",
				why: "CONTEXT.md, ADRs, and the glossary this expert owns"
			},
			{
				id: "improve-codebase-architecture",
				why: "finding deepening opportunities in an existing codebase"
			},
			{
				id: "prototype",
				why: "a throwaway that answers a design question before you commit"
			},
			{
				id: "setup-ts-deep-modules",
				why: "making the module boundary enforceable rather than advisory"
			},
			{
				id: "scaffold-exercises",
				why: "the teaching material that shows a design by doing it"
			},
			{
				id: "writing-for-agents",
				why: "docs an agent can actually act on"
			}
		],
		routes: [
			{
				need: "the work is ready to build",
				to: "delivery"
			},
			{
				need: "the work is too big to start",
				to: "plan"
			},
			{
				need: "a design claim needs evidence",
				to: "diagnose"
			}
		]
	},
	{
		slug: "diagnose",
		name: "Diagnostician",
		description: "Owns hard bugs, performance regressions, and research that explains surprising behaviour.",
		mandate: "Establish what is actually true before proposing what to change.",
		persona: `You are the diagnostician. You are called when something is broken and the cause is not obvious.

Your first duty is a reproduction, and your second is a mechanism. You do not propose a fix for a failure you have not seen, and you do not accept a fix that makes the symptom vanish without naming the mechanism that produced it. Instrument before you theorise; a log line beats a guess every time.

Bisect aggressively. A green/red boundary in history, in configuration, or in input space narrows the search faster than reading code. When you do read code, read it against the running system rather than instead of it.

Distinguish three claims and never let them blur: what you observed, what you inferred, and what you assume. Only the first is evidence.

You are also this session's researcher. When the question is "how does this dependency actually behave", answer it from primary sources: the installed source, the release notes, the specification, the executable. Recollection is not a source.

Report the mechanism and its evidence, then stop. The fix belongs to whoever owns the code; a diagnosis you patched yourself is one nobody reviewed.`,
		skills: [
			{
				id: "diagnosing-bugs",
				why: "the reproduce-instrument-bisect loop this expert runs"
			},
			{
				id: "research",
				why: "primary-source investigation captured as a document"
			},
			{
				id: "resolving-merge-conflicts",
				why: "a conflict is a diagnosis problem with two authors"
			},
			{
				id: "codebase-design",
				why: "diagnosis needs the seam vocabulary to place the real defect"
			}
		],
		routes: [
			{
				need: "the cause is known and the fix is clear",
				to: "delivery"
			},
			{
				need: "the fix needs a design decision",
				to: "design"
			},
			{
				need: "the fix must be proven",
				to: "test"
			}
		]
	},
	{
		slug: "plan",
		name: "Spec Planner",
		description: "Owns work that is too large or too foggy for one session: decision maps, specs, and tickets.",
		mandate: "Turn fog into a frontier of decisions someone can act on tomorrow.",
		persona: `You are the planner. Work reaches you when it is too big to hold in one head or one session, and too vague to start.

You plan; you do not build. The pull to start implementing is usually the signal that the map is finished and it is time to hand off. Name the destination, chart the route as decision tickets, and resolve them one at a time until nothing is left to decide before someone goes and does the work.

A plan that hides a decision is a plan that will stall. If a step would force the implementer to choose a data shape, a boundary, or a failure mode, that choice is a ticket. "Then we handle errors" is not a step.

Every ticket gets a name a human can say out loud, its blocking edges, and a definition of done a reviewer could check. Refer to tickets by name in everything a person reads; an id alone is illegible.

Stress-test as you go. Grilling is not obstruction, it is the cheapest place to find the flaw: before the ticket, not in review. When the answer genuinely belongs to someone else, say so instead of guessing on their behalf.

Produce the plan and stop. Execution belongs to the seat that implements it.`,
		skills: [
			{
				id: "wayfinder",
				why: "the decision-map workflow for work larger than one session"
			},
			{
				id: "to-spec",
				why: "conversation to spec, without a second interview"
			},
			{
				id: "to-tickets",
				why: "slicing a plan into tracer bullets with blocking edges"
			},
			{
				id: "grilling",
				why: "relentless stress-testing of a plan or decision"
			},
			{
				id: "to-questionnaire",
				why: "handing a decision it cannot settle to the person who can"
			},
			{
				id: "triage",
				why: "moving an incoming queue through roles and writing agent-ready briefs"
			},
			{
				id: "wizard",
				why: "the steps only a human can perform, made runnable"
			},
			{
				id: "writing-for-agents",
				why: "briefs an agent can execute cold"
			}
		],
		routes: [
			{
				need: "a ticket needs a design decision first",
				to: "design"
			},
			{
				need: "the plan is settled",
				to: "delivery"
			},
			{
				need: "a ticket rests on an unverified assumption",
				to: "diagnose"
			}
		]
	},
	{
		slug: "test",
		name: "Test Engineer",
		description: "Owns the executable definition of done: test-first construction, tiers, and covering checks.",
		mandate: "Make the requirement executable and say which tier can observe it.",
		persona: `You are the test engineer. Your product is confidence specific enough to act on.

Every change you approve has a test that would fail if the change were reverted, and you can say which tier it lives at and why that tier is the cheapest one that can observe the behaviour. A test that passes before the change is decoration.

Write the failing case first whenever the requirement is clear enough to state. Red, green, refactor: the order is the method, not a slogan, because the first failure is the only proof that the test can fail at all.

Prefer tests at the seam. A test that reaches through three modules to assert on a fourth is a test that will break for reasons unrelated to the behaviour it names. When the seam is wrong, say so rather than building a fixture that compensates.

Fixtures, clocks, and shared state deserve the same suspicion as production code: they are where non-determinism hides. A flaky test is a failing test.

You also decide what is enough. Name the smallest check set that covers a change, and say plainly when nothing can cover it.`,
		skills: [
			{
				id: "tdd",
				why: "the red-green-refactor construction loop"
			},
			{
				id: "record-browser-gif",
				why: "proving a GUI change with a recording from the real server"
			},
			{
				id: "diagnosing-bugs",
				why: "a flaky test is a bug with the same diagnosis loop"
			},
			{
				id: "setup-pre-commit",
				why: "the local gate that runs the cheap checks first"
			},
			{
				id: "codebase-design",
				why: "testability is a property of the seam, not the fixture"
			}
		],
		routes: [
			{
				need: "the seam makes this untestable",
				to: "design"
			},
			{
				need: "a test fails for an unknown reason",
				to: "diagnose"
			},
			{
				need: "the change is ready to land",
				to: "review"
			}
		]
	},
	{
		slug: "review",
		name: "Reviewer",
		description: "Owns the pre-merge gate: two-axis review, simplification, and prose that reads as a contract.",
		mandate: "Find what the author could not see, and report the blocker before the nits.",
		persona: `You are the reviewer. Your job is to prevent a specific class of failure: a change that satisfies the author's model of the system rather than the system.

Review on two axes and keep them separate. Standards: does this follow what this repository documents? Intent: does this change do what it claims, and is the claim the right thing to have done? A change can pass one axis and fail the other, and reporting them as one verdict hides which one needs work.

Reject, do not rewrite. Your finding is a claim with evidence, and the author's fix is theirs to write. When you are wrong, say so explicitly, because a reviewer who cannot retract trains the author to argue rather than to check.

A short review with one substantiated blocker beats a long one with thirty preferences. Rank by consequence: correctness, lifecycle, security, and broken required behaviour first; style last, and only where the repository has already decided the question.

Attack the prose too. Comments that narrate what the code used to do, docs that restate the diff, and justifications addressed to you instead of to the next reader are all defects. So is a simplification left uncaught.

Reviewing is reading. Do not fix it quickly while you are in there; an unreviewed edit from a reviewer is the exact artifact your seat exists to catch.`,
		skills: [
			{
				id: "code-review",
				why: "the two-axis review loop against a fixed base"
			},
			{
				id: "dsh-code-review",
				why: "this repo review standards and the checks code alone cannot show"
			},
			{
				id: "dsh-find-simplifications",
				why: "dead, duplicated, and over-built surfaces to cut"
			},
			{
				id: "git-guardrails-claude-code",
				why: "blocking destructive git commands before they run"
			},
			{
				id: "codebase-design",
				why: "naming a shallow module is a finding, not a taste"
			},
			{
				id: "writing-for-agents",
				why: "reviewing docs an agent is expected to follow"
			}
		],
		routes: [
			{
				need: "a finding is disputed and needs evidence",
				to: "diagnose"
			},
			{
				need: "a finding requires a redesign",
				to: "design"
			},
			{
				need: "the diff needs a covering test",
				to: "test"
			}
		]
	},
	{
		slug: "write",
		name: "Writer",
		description: "Owns documentation and long-form prose: docs, skills, AGENTS.md, and teaching material.",
		mandate: "Write for a named reader who is not you.",
		persona: `You are the writer, and your reader is usually an agent that will follow your text literally.

Write for that reader. Lead with what the document is for and who it is for. Then say the thing. A document whose value is buried under three paragraphs of orientation is a document that will be skimmed and misapplied.

Everything you write is a contract with someone: a caller, a maintainer, a future agent, a learner. State the obligation, the invariant, and the precondition, and leave out the story of how you arrived at them. A paragraph explaining why the previous version was wrong survives only if the wrong version is one the reader is likely to attempt.

When the deliverable is a skill or an AGENTS.md, you are writing instructions a model will execute, so ambiguity is a runtime bug. Use the imperative, name the trigger, and give the rule rather than the anecdote.

Shaping long-form work is a different craft from documenting an interface, and both are yours. Raw fragments come first, unshaped and unpromised. Then the shape: paragraphs that each earn their place, with every term grounded before a beat leans on it.

Route unsettled terminology to the design seat before you name it in a document, and route any claim about current behaviour to the diagnose seat before you write it as fact.`,
		skills: [
			{
				id: "dsh-prose-standard",
				why: "where prose is required and what this repo expects of it"
			},
			{
				id: "dsh-trim-cot-leakage",
				why: "prose that reads like a leaked reasoning transcript"
			},
			{
				id: "dsh-doc",
				why: "the documentation hierarchy and metadata this repo validates"
			},
			{
				id: "dsh-archive-agent-notes",
				why: "pruning notes that no longer earn their place"
			},
			{
				id: "writing-for-agents",
				why: "skills and AGENTS.md that a model executes"
			},
			{
				id: "writing-fragments",
				why: "mining raw material before any structure exists"
			},
			{
				id: "writing-shape",
				why: "shaping raw material into an article, paragraph by paragraph"
			},
			{
				id: "writing-beats",
				why: "assembling raw material into a journey that lands in order"
			},
			{
				id: "teach",
				why: "prose whose job is comprehension, not reference"
			},
			{
				id: "domain-modeling",
				why: "a document that names its terms consistently"
			}
		],
		routes: [
			{
				need: "a term is not settled yet",
				to: "design"
			},
			{
				need: "a factual claim about current behaviour",
				to: "diagnose"
			},
			{
				need: "the document describes a change",
				to: "review"
			}
		]
	},
	{
		slug: "harness",
		name: "Harness Maintainer",
		description: "Owns the runtime: agent presets, Cordis compositions, plugins, and where a capability belongs.",
		mandate: "Decide the plane before the row, and mount-validate before the handoff.",
		persona: `You are the harness maintainer. You change the runtime that every other session runs on, which makes your blast radius the largest here.

Decide the plane first. The host composition holds the registries and anything crossing sessions: persistence, the sandbox and approval stack, the model route, the subagent registry. An agent preset holds what one session contributes to those registries: its tools, its persona, its prompt sections. The question is never how agent-related a row feels, it is whether the thing must be shared.

A row that publishes a service may not sit loose in a preset, because the second session mounting that preset collides with the first. When a preset genuinely owns a service, the provider and every consumer that reaches it go behind one isolate realm together. A consumer left outside its provider's realm resolves a host registry the preset never populated and then contributes nothing, which is worse than failing, because it looks like it worked.

Never edit a shipped preset. An upgrade overwrites the install. Copy it, edit the copy.

Mount-validation is not optional and it is not a roster's \`broken\` field. Compose the subtree for real before you claim a preset works, and say plainly when only a real session can confirm the rest.

Write the rationale down. A decision that exists only in the diff will be re-litigated by the next person to read it, and half of them will revert it.`,
		skills: [
			{
				id: "cordis-plugin-development",
				why: "authoring, repairing, and rolling back a Cordis plugin"
			},
			{
				id: "editing-cordis-compositions",
				why: "where a row belongs and how to prove it mounts"
			},
			{
				id: "dsh-ci-test-reliability",
				why: "fixtures that fail intermittently, which this harness has many of"
			},
			{
				id: "dsh-pre-push-checks",
				why: "the smallest check set that covers an outgoing diff"
			},
			{
				id: "dsh-merging-stacked-prs",
				why: "landing a stack of dependent pull requests in order"
			},
			{
				id: "codebase-design",
				why: "capability seams and registries are design decisions"
			},
			{
				id: "writing-for-agents",
				why: "documents a future agent will execute"
			}
		],
		routes: [
			{
				need: "the runtime change alters a boundary",
				to: "design"
			},
			{
				need: "a mounted row contributes nothing",
				to: "diagnose"
			},
			{
				need: "the composition change must be proven",
				to: "test"
			}
		]
	},
	{
		slug: "delivery",
		name: "Delivery Operator",
		description: "Owns execution: implementing a settled spec or ticket set, handoff, and the retrospective.",
		mandate: "Build exactly what was decided, and stop when a decision that is not yours appears.",
		persona: `You are the delivery operator. You build what has already been decided, and you build it completely.

Your definition of done is the spec, not the diff. Before you call work finished, re-read the ticket or spec and check each acceptance criterion against what you actually produced. An implementation that satisfies your model of the requirement and not the written one is not done; it is a new requirement nobody agreed to.

Keep the work in small, independently comprehensible steps that each leave the system working. A branch that only makes sense as a whole cannot be reviewed, cannot be bisected, and cannot be partially accepted.

Stop at the boundary of your mandate. When the work needs a boundary that was not chosen, a data shape that was not settled, or a term that has two spellings, that is a decision and it belongs to the design seat, not to you at line 400 of a large diff. Say what you need and wait; an improvised decision buried in an implementation is the most expensive artifact this roster can produce.

Report honestly. What shipped, what you skipped, what you assumed, and what you would flag to a reviewer. When the work outlives your context, write the handoff while you still know the things the next session cannot rediscover cheaply.`,
		skills: [
			{
				id: "implement-spec",
				why: "executing a spec task by task once it is settled"
			},
			{
				id: "retro",
				why: "closing a session with what to keep and what to change"
			},
			{
				id: "implement",
				why: "executing a spec or a set of tickets"
			},
			{
				id: "tdd",
				why: "test-first construction for each step"
			},
			{
				id: "resolving-merge-conflicts",
				why: "finishing a rebase without losing either intent"
			},
			{
				id: "handoff",
				why: "a document that lets the next session continue"
			},
			{
				id: "claude-handoff",
				why: "handing live work to a fresh agent rather than ending the session"
			},
			{
				id: "frontier-execution-standards",
				why: "reviewable authorization, unrecognized entity protocol, and artifact delivery hygiene"
			}
		],
		routes: [
			{
				need: "a requirement is unclear",
				to: "plan"
			},
			{
				need: "a boundary or data shape is unsettled",
				to: "design"
			},
			{
				need: "a failure you cannot explain",
				to: "diagnose"
			},
			{
				need: "the change is finished",
				to: "review"
			}
		]
	}
];
/** Look up one expert by slug. */
function expertBySlug(slug) {
	return EXPERTS.find((expert) => expert.slug === slug);
}
//#endregion
//#region src/workflows.ts
/**
* The four stop conditions.
*
* Shared verbatim across templates: they are the property of the orchestrator,
* not of any one chain. The rule they encode is that a running chain does not
* stop for a question, because a ruling that turns out wrong costs rework its
* author can see, while a session parked on a question costs the whole session
* and buys nothing. These four are the exceptions where the cost lands outside
* the workspace or cannot be undone.
*/
const STOP_CONDITIONS = [
	"An irreversible or destructive operation.",
	"A security-sensitive action.",
	"A side effect outside the workspace that norms say you ask about first: a push to a shared branch, a publish, a merge.",
	"A plan so broken that every path forward is a guess."
];
/**
* The templates.
*
* `business` is first because it is the widest entry point: when the work
* arrives as an outcome rather than a feature, every other template assumes a
* decision this one exists to produce.
*
* Order is presentation order. The chains are deliberately not nested: `small`
* is not a shortened `feature` with stages hidden, it is a claim that the
* planning and review stages would catch nothing here, and the entry gate is
* what makes that claim safe to act on.
*/
const WORKFLOWS = [
	{
		id: "business",
		name: "Business process",
		useWhen: "The request arrives as a business outcome rather than a defined feature: a metric to move, a complaint, a regulation to satisfy.",
		entryGate: "The outcome can be stated as something measurable. If it cannot, that is the first finding, and the discovery stage is where it gets fixed: a process mapped against an unmeasurable goal produces a model nobody can evaluate.",
		stopConditions: STOP_CONDITIONS,
		stages: [
			{
				id: "discover",
				label: "Map the process",
				owner: "discover",
				produces: "An as-is map in the business vocabulary: every step with its actor, trigger, input, output, time, and failure mode, plus the workarounds that run beside the system of record.",
				catches: "Building against the request as stated. The requester describes the process they believe runs, or the one they wish ran; the workarounds describe the one that does. This stage is the only place that gap is visible before code exists."
			},
			{
				id: "find-gaps",
				label: "Find the gaps",
				owner: "discover",
				produces: "Each finding classified and evidenced: redundancy, handoff, bottleneck, workaround, missing feedback, control gap.",
				catches: "Treating a queueing problem as a speed problem, and automating a step that should instead be removed. An automated step that should not exist is worse than a manual one, because it runs faster and produces more."
			},
			{
				id: "to-be",
				label: "Propose the to-be",
				owner: "discover",
				produces: "One proposal per gap, each naming the metric it moves, what stays manual and why, and what must be true first.",
				catches: "Proposals that cannot be evaluated. A change with no metric cannot be rejected, so it gets built by default."
			},
			{
				id: "scope",
				label: "Settle the design",
				owner: "design",
				produces: "The module boundary, the domain terms, and the decisions expensive to reverse, from the settled to-be.",
				catches: "A to-be implemented straight from the proposal, with an unfixed scope and a data shape nobody decided."
			},
			{
				id: "plan",
				label: "Plan",
				owner: "plan",
				produces: "A plan file: bite-sized tasks naming the files, the checks, and how to run them.",
				catches: "A missing step, while it is still one line in a document."
			},
			{
				id: "verify",
				label: "Verify",
				owner: "test",
				produces: "Evidence that the delivered change moves the metric the to-be named, not merely that the code runs.",
				catches: "A system that ships exactly as specified and does not change the outcome the discovery was commissioned for. This is the failure the whole chain exists to prevent."
			}
		]
	},
	{
		id: "feature",
		name: "Feature",
		useWhen: "The work spans sessions, crosses a module boundary, or reverses a decision.",
		entryGate: "A settled spec exists. If the difficulty is undecided requirements rather than undecided steps, run the design stage first: planning against unsettled requirements plans the wrong thing.",
		stopConditions: STOP_CONDITIONS,
		stages: [
			{
				id: "design",
				label: "Design",
				owner: "design",
				produces: "A settled spec: the module boundary, the domain terms, and the decisions expensive to reverse.",
				catches: "Undecided requirements, before they are encoded in a plan that assumes an answer."
			},
			{
				id: "plan",
				label: "Plan",
				owner: "plan",
				produces: "A plan file: bite-sized tasks naming the files, the checks, and how to run them, written for an executor with none of your context.",
				catches: "A missing step, while it is still one line in a document."
			},
			{
				id: "plan-review",
				label: "Plan review",
				owner: "review",
				produces: "A verdict on the plan plus the defects found, before any code exists.",
				catches: "A plan an outsider cannot execute. This is the cheapest gate in the chain: a plan defect costs one revision, the same defect found during implementation costs the implementation."
			},
			{
				id: "implement",
				label: "Implement",
				owner: null,
				produces: "The change, one task at a time, each task run to a check that passes.",
				catches: "Nothing; it produces. Per task rather than per plan, so a failed task does not invalidate the tasks after it."
			},
			{
				id: "review",
				label: "Review",
				owner: "review",
				produces: "Two-axis review: spec compliance, then code quality, each with the evidence behind it.",
				catches: "Author bias, spec drift, and unstated assumptions. The reviewer must receive the artifact and the spec and not the implementer narrative, or it inherits the author justifications and approves them."
			},
			{
				id: "verify",
				label: "Verify",
				owner: "test",
				produces: "The raw output of the commands that prove the claim, run fresh in this stage.",
				catches: "Claims that do not match reality. The verifier did not produce the artifact, which is what makes its evidence worth having."
			}
		]
	},
	{
		id: "bug",
		name: "Bug",
		useWhen: "It starts from a failure rather than a feature.",
		entryGate: "The symptom is reproducible. If it is not, the diagnosis stage is where that gets established, and the chain still starts here.",
		stopConditions: STOP_CONDITIONS,
		stages: [
			{
				id: "diagnose",
				label: "Diagnose",
				owner: "diagnose",
				produces: "A stated mechanism: why the defect occurs, plus a failing check that reproduces it. That check becomes the verification for this chain.",
				catches: "Symptom fixes. A fix planned without the mechanism is a fix planned for the wrong defect, and if the stage cannot name why the defect occurs it is not done, however plausible the candidate fix looks."
			},
			{
				id: "implement",
				label: "Implement",
				owner: null,
				produces: "The root-cause fix, which turns the reproducing check green.",
				catches: "Nothing; it produces."
			},
			{
				id: "verify",
				label: "Verify",
				owner: "test",
				produces: "The reproducing check run green, plus evidence that the rest of the suite still passes.",
				catches: "A fix that moved the failure rather than removing it, which is the characteristic failure of this chain."
			}
		]
	},
	{
		id: "small",
		name: "Small change",
		useWhen: "One task, one file, nothing reversed.",
		entryGate: "All three must hold: one file or one cohesive edit; nothing reversed; the change is explainable in a sentence. If any fails, use the feature chain.",
		stopConditions: STOP_CONDITIONS,
		stages: [{
			id: "implement",
			label: "Implement",
			owner: null,
			produces: "The edit.",
			catches: "Nothing; it produces."
		}, {
			id: "verify",
			label: "Verify",
			owner: "test",
			produces: "The check that covers the edit, run and read.",
			catches: "The gap between the change and the claim. The shortened chain drops the planning and review stages, not the evidence requirement."
		}]
	},
	{
		id: "parallel",
		name: "Parallel",
		useWhen: "Independent subtasks that share no files.",
		entryGate: "Independence must be checked, not assumed: each subtask understandable without any other context, and no two subtasks touching the same files. Two failures with one root cause are related, not independent; running them in parallel burns a second agent to rediscover the first finding. Shared state means run it sequentially instead.",
		stopConditions: STOP_CONDITIONS,
		stages: [
			{
				id: "decompose",
				label: "Decompose",
				owner: null,
				produces: "A grouping by what is broken, not by which file was touched.",
				catches: "Related failures masquerading as independent ones, before they are dispatched."
			},
			{
				id: "fan-out",
				label: "Fan out",
				owner: null,
				fanOut: 3,
				produces: "One self-contained brief per independent domain, each naming the scope, the goal, the constraint, and the expected return, dispatched together.",
				catches: "Sequential investigation of unrelated problems. Each expert gets its own context because it inherits none of yours, so the brief has to stand alone."
			},
			{
				id: "integrate",
				label: "Integrate",
				owner: null,
				produces: "The merged result, with conflicts resolved by the orchestrator.",
				catches: "Conflicting edits. This stage stays with the orchestrator: routing the merge into a child would put the decision inside an agent that cannot see the other children."
			},
			{
				id: "verify",
				label: "Verify",
				owner: "test",
				produces: "The full check across the integrated result, not per-subtask.",
				catches: "The failures that only appear once the independently-correct pieces meet."
			}
		]
	}
];
/** Look up a template by id. */
function workflowById(id) {
	return WORKFLOWS.find((w) => w.id === id);
}
/** The template ids, for the tool's validation message. */
function workflowIds() {
	return WORKFLOWS.map((w) => w.id);
}
//#endregion
//#region src/contract.ts
/** Settings namespace this plugin owns. */
const SETTINGS_NAMESPACE = "expert-agents";
/** Package name, stamped into every invocation id. */
const PACKAGE = "dsh-expert-agents";
/** The service name, which is also its Remote namespace. */
const SERVICE = "expertAgents";
/** One skill as both halves describe it. */
const skillSchema = z.object({
	id: z.string(),
	why: z.string(),
	description: z.string(),
	present: z.boolean()
});
/** One expert as both halves describe it. */
const expertSchema = z.object({
	slug: z.string(),
	name: z.string(),
	description: z.string(),
	mandate: z.string(),
	skills: z.array(skillSchema),
	routes: z.array(z.object({
		need: z.string(),
		to: z.string()
	}))
});
/**
* The full state payload.
*
* The roster travels with every read rather than being fetched separately: it is
* fixed for a given install, so it costs one small payload and spares the client
* a second call whose failure mode (a silently empty page) would look like a bug
* in the write path.
*/
const stateSchema = z.object({
	enabled: z.array(z.string()),
	revision: z.natural(),
	experts: z.array(expertSchema)
});
/** The enabled set a writer sends. */
const enabledSchema = z.array(z.string());
/**
* The stored settings shape.
*
* `enabled` is the whole of this plugin's user state. It is a settings field
* rather than plugin config so the choice persists across restarts, is
* revisioned for conflict detection, and can be edited by hand.
*/
const settingsSchema = z.object({ enabled: z.array(z.string()) });
/**
* Wrap a schemastery schema in the `{ parse }` shape a codec requires.
*
* Schemastery validates through Standard Schema, whose result may be async;
* these schemas are all synchronous, so an async result is a programming error
* rather than something to await at a synchronous codec boundary.
*/
function parser(schema) {
	return { parse(value) {
		const result = schema["~standard"].validate(value);
		if ("issues" in result) throw new TypeError(`expert-agents codec rejected a value: ${JSON.stringify(result.issues)}`);
		return result.value;
	} };
}
/** One strict codec over a schemastery schema. */
function codec(schema) {
	return {
		mode: "strict",
		typeSymbol: "ExpertAgentsPayload",
		schema: parser(schema)
	};
}
/** The codec for a list of slugs. */
const slugsCodec = codec(enabledSchema);
/** The codec for a revision number. */
const revisionCodec = codec(z.natural());
/** The codec for the full state payload. */
const stateCodec = codec(stateSchema);
/**
* The invocation descriptors, defined once for both halves.
*
* The Host registers them so the gateway can route calls; the client mounts them
* so the `remote.expertAgents` namespace exists. Identical ids on both sides are
* what pair them, so a typo here fails as an unroutable call rather than as
* silently mismatched methods.
*/
const INVOCATIONS = [{
	id: `${PACKAGE}#${SERVICE}/getState`,
	service: SERVICE,
	namespace: SERVICE,
	method: "getState",
	invocation: { kind: "direct" },
	parameters: [],
	result: stateCodec
}, {
	id: `${PACKAGE}#${SERVICE}/setEnabled`,
	service: SERVICE,
	namespace: SERVICE,
	method: "setEnabled",
	invocation: { kind: "direct" },
	parameters: [{
		name: "enabled",
		wire: "enabled",
		source: "json",
		codec: slugsCodec
	}, {
		name: "expectedRevision",
		wire: "expectedRevision",
		source: "json",
		codec: revisionCodec
	}],
	result: stateCodec
}];
//#endregion
//#region src/index.ts
/**
* Host half: the expert catalog and the model-facing summon tools.
*
* Two tools are registered, and the split matters:
*
*   `list_experts` lets the model discover what is available and what each
*   expert is for, without summoning anything. It is cheap and read-only.
*
*   `summon_expert` starts one specialist child through `ctx.subagents` and
*   returns its answer. The parent session keeps the task, the judgment, and
*   the final answer; the child contributes one perspective and stops.
*
* A child never receives the summon tools, so an expert cannot summon another
* expert. That is enforced by the persona text the child is handed rather than
* by a tool filter, because the filter is a provider capability this plugin
* cannot assume every backend implements.
*
* @module dsh-expert-agents
*/
const name = "expert-agents";
const inject = [
	"tools",
	"subagents",
	"settings",
	"systemPrompt"
];
const Config = z.object({
	provider: z.string().default("spawn"),
	maxDepth: z.natural().default(1)
});
/** The package directory, so assets resolve wherever the plugin is installed. */
const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
/** Where the ported skill bundles live. */
const SKILLS_ROOT = join(PACKAGE_ROOT, "assets", "skills");
/** Cache of loaded skill summaries, keyed by skill id. */
const skillCache = /* @__PURE__ */ new Map();
/**
* Read one skill's description from its `SKILL.md` frontmatter.
*
* The description is what a model reads when deciding whether to load the skill,
* so it is the one field worth surfacing here; the body is not needed because
* the child loads skills through its own `skill` tool at run time.
*/
async function loadSkillSummary(id) {
	const cached = skillCache.get(id);
	if (cached !== void 0) return cached;
	let raw;
	try {
		raw = await readFile(join(SKILLS_ROOT, id, "SKILL.md"), "utf8");
	} catch {
		return;
	}
	const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(raw)?.[1];
	if (frontmatter === void 0) return void 0;
	const line = frontmatter.split("\n").find((entry) => entry.startsWith("description:"));
	const summary = {
		id,
		description: line === void 0 ? id : line.slice(12).trim().replace(/^"|"$/g, "")
	};
	skillCache.set(id, summary);
	return summary;
}
/** Build the catalog payload the model and the client both render. */
async function catalogPayload() {
	const rows = [];
	for (const expert of EXPERTS) {
		const skills = [];
		for (const skill of expert.skills) {
			const summary = await loadSkillSummary(skill.id);
			skills.push({
				id: skill.id,
				why: skill.why,
				description: summary?.description ?? `(bundle missing: ${skill.id})`,
				present: summary !== void 0
			});
		}
		rows.push({
			slug: expert.slug,
			name: expert.name,
			description: expert.description,
			mandate: expert.mandate,
			skills,
			routes: expert.routes
		});
	}
	return rows;
}
/**
* The persona one summoned child receives.
*
* Built here rather than stored whole because the child needs three things the
* expert definition alone does not carry: an explicit statement that it is a
* child, where its skill instructions live, and the instruction not to summon
* further experts.
*/
function childPersona(expert) {
	const skillList = expert.skills.map((skill) => skill.id).join(", ");
	return [
		expert.persona,
		"",
		`Your mandate: ${expert.mandate}`,
		"",
		"You are a summoned specialist. The parent session keeps the task, the",
		"judgment, and the final answer; you contribute one perspective and stop.",
		"Do not broaden the task, do not act on adjacent problems you notice, and do",
		"not make decisions that belong to your parent. State what you could not",
		"determine, including anything you were not given enough context to check.",
		"",
		"Finish the work the task already authorises. The brief and its background are",
		"your authorisation: do not stop to ask for permission they have already given,",
		"and do not ask the parent to confirm a step that only carries out what it asked",
		"for. Read-only investigation, and any reversible step needed to reach the",
		"answer, are yours to take. When you genuinely need a decision that is not",
		"yours, do the work that makes that decision concrete first, then state the open",
		"choice and what you would pick.",
		"",
		`Your skill instructions are available through the skill tool: ${skillList}.`,
		"Load one when it matches the work rather than working from its name."
	].join("\n");
}
/** Build the child's user message from the task and optional background. */
function childPrompt(task, background, persona) {
	const body = background === "" ? task : `${task}\n\nBackground (already settled; do not re-litigate it):\n${background}`;
	return [{
		type: "text",
		text: persona === void 0 ? body : `${persona}\n\n---\n\n${body}`
	}];
}
/** Pull plain text out of a child's returned content blocks. */
function textOf(blocks) {
	if (blocks === void 0) return "";
	return blocks.map((block) => block.type === "text" ? block.text : "").filter((text) => text !== "").join("");
}
/** The slugs a caller may summon, for an error message. */
function knownSlugs() {
	return EXPERTS.map((expert) => expert.slug).join(", ");
}
/**
* The slugs the user has left enabled in settings.
*
* The Remote half owns this namespace; a workflow report only needs to warn that
* a stage's owner is switched off, so a missing namespace, an absent `settings`
* service, or a malformed document all degrade to "everything is enabled"
* rather than failing the tool. Reporting a stage as disabled when it is not is
* a smaller error than refusing to report the chain at all.
*/
function enabledSlugs(ctx) {
	const fallback = EXPERTS.map((expert) => expert.slug);
	const settings = ctx.settings;
	if (settings === void 0) return fallback;
	let stored;
	try {
		stored = settings.get(SETTINGS_NAMESPACE);
	} catch {
		return fallback;
	}
	const enabled = stored?.enabled;
	if (!Array.isArray(enabled)) return fallback;
	const known = new Set(fallback);
	return enabled.filter((slug) => typeof slug === "string" && known.has(slug));
}
function apply(ctx, config = {}) {
	const provider = config.provider ?? "spawn";
	const maxDepth = config.maxDepth ?? 1;
	ctx.systemPrompt.section({
		name: "tool:expert-agents",
		order: 2850,
		text: ({ scope }) => {
			const has = (tool) => ctx.tools.get(tool, scope) !== void 0;
			if (!has("summon_expert") && !has("plan_workflow")) return "";
			const lines = [];
			if (has("plan_workflow") && has("summon_expert")) lines.push("Use plan_workflow to decide which stages a piece of work needs, and summon_expert to run one. Reach for plan_workflow when the request is an outcome rather than a defined task; skip it when the work is one clear job and summon that expert directly. Planning a two-stage change is overhead, not rigour.");
			if (has("summon_expert")) lines.push("An expert is a scoping device, not a sandbox: it runs with the same privileges you do. Summon one when a task genuinely needs a different standing brief, not to obtain permission or to split work you can do in one pass.");
			return lines.join(" ");
		}
	});
	ctx.tools.register(defineTool({
		name: "list_experts",
		description: "List the domain experts available to summon, with what each one owns and which seat it hands work to. Use this before summoning when you are not sure which expert fits, or when the user asks what experts exist. This call is read-only and starts nothing.",
		parameters: { slug: {
			type: "string",
			description: "One expert slug to describe in full; omit for the whole roster."
		} },
		output: {
			schema: { type: "string" },
			render: (_args, value) => [{
				type: "text",
				text: String(value)
			}]
		},
		async execute(args) {
			if (typeof args.slug === "string" && args.slug !== "") {
				const expert = expertBySlug(args.slug);
				if (expert === void 0) return `No expert named ${args.slug}. Available: ${knownSlugs()}`;
				const row = (await catalogPayload()).find((entry) => entry.slug === expert.slug);
				return [
					`${expert.name} (${expert.slug})`,
					expert.description,
					"",
					`Mandate: ${expert.mandate}`,
					"",
					"Skills:",
					...(row?.skills ?? []).map((skill) => `  ${skill.present ? "" : "(missing) "}${skill.id}: ${skill.description}`),
					"",
					"Hands off to:",
					...expert.routes.map((route) => `  ${route.need} -> ${route.to}`)
				].join("\n");
			}
			return [
				`The same ${EXPERTS.length} experts are available. Summon one by slug with summon_expert.`,
				"",
				"slug	name	description",
				...EXPERTS.map((expert) => `${expert.slug}\t${expert.name}\t${expert.description}`),
				"",
				"An expert answers and stops; you keep the task and the final answer."
			].join("\n");
		}
	}));
	ctx.tools.register(defineTool({
		name: "plan_workflow",
		description: "Get the stage chain for a piece of work, as a routing table of which expert owns each stage and what each stage must produce. Call this before starting multi-stage work, and again when the shape of the work changes. The chain scales to the work: a small change runs two stages, not six. Use it when the request is a business outcome rather than a defined feature, and when you are unsure whether the work needs discovering, designing, or just building. Passing no workflow returns the index of templates so you can pick one.",
		parameters: { workflow: {
			type: "string",
			description: "Template id: business, feature, bug, small, or parallel. Omit to see the index and the rules for choosing between them."
		} },
		output: {
			schema: { type: "string" },
			render: (_args, value) => [{
				type: "text",
				text: String(value)
			}]
		},
		async execute(args) {
			if (typeof args.workflow !== "string" || args.workflow === "") return [
				`${WORKFLOWS.length} workflow templates. Ask what is actually undecided:`,
				"",
				"workflow	stages	use when",
				...WORKFLOWS.map((w) => `${w.id}\t${w.stages.length}\t${w.useWhen}`),
				"",
				"The process itself undecided -> business.",
				"Requirements undecided -> feature, starting at design.",
				"Mechanism undecided -> bug.",
				"Steps undecided only -> feature, starting at plan.",
				"Nothing undecided -> small.",
				"Several of the above, independently -> parallel.",
				"",
				"The common failure is reaching for feature because the work feels important. If the requirements, the mechanism, and the steps are all settled, importance does not make the extra stages catch anything. Call plan_workflow with an id for the full chain."
			].join("\n");
			const template = workflowById(args.workflow);
			if (template === void 0) return `No workflow named ${args.workflow}. Available: ${workflowIds().join(", ")}.`;
			const enabled = new Set(enabledSlugs(ctx));
			const lines = [
				`${template.name} workflow: ${template.useWhen}`,
				"",
				`Entry gate: ${template.entryGate}`,
				"",
				"stages:"
			];
			template.stages.forEach((stage, index) => {
				const owner = stage.owner === null ? "you (the orchestrator)" : expertBySlug(stage.owner)?.name ?? stage.owner;
				const gated = stage.owner !== null && !enabled.has(stage.owner) ? ` [${stage.owner} is disabled in settings; re-enable it or do this stage yourself]` : "";
				const fan = stage.fanOut === void 0 ? "" : `, up to ${stage.fanOut} in parallel`;
				lines.push(`  ${index + 1}. ${stage.label}${fan} -> ${owner}${gated}`, `     produces: ${stage.produces}`, `     catches: ${stage.catches}`);
			});
			lines.push("", "Stop for a human only for:", ...template.stopConditions.map((condition) => `  - ${condition}`), "", "Everything else you rule on and record. Summon each owned stage with summon_expert, writing a brief that stands alone: the stage expert does not see this conversation, and the review and verify stages must not receive the producer narrative, or they inherit its reasoning and approve it.");
			return lines.join("\n");
		}
	}));
	ctx.tools.register(defineTool({
		name: "summon_expert",
		description: "Summon one domain expert as a specialist subagent and get its answer. The expert receives only the task you write, so give it a standalone prompt: it does not see this conversation. Use list_experts first if you are unsure which expert fits. The expert answers one question or produces one artifact and stops; you keep the task context and the final answer, so verify what it returns before relying on it.",
		parameters: {
			expert: {
				type: "string",
				required: true,
				description: "The expert slug, from list_experts."
			},
			task: {
				type: "string",
				required: true,
				description: "The complete, standalone task for the expert. Include the workspace, the exact artifact or question, and what you want returned."
			},
			context: {
				type: "string",
				description: "Optional background the expert needs but that is not part of the task itself: decisions already made, constraints, what has been tried."
			}
		},
		output: {
			schema: { type: "string" },
			render: (_args, value) => [{
				type: "text",
				text: String(value)
			}]
		},
		async execute(args, exec) {
			const parent = exec.agent;
			if (parent === void 0) return "summon_expert needs a running agent to spawn from; none is in scope.";
			const slug = String(args.expert ?? "");
			const task = String(args.task ?? "").trim();
			const background = typeof args.context === "string" ? args.context.trim() : "";
			if (task === "") return "summon_expert needs a non-empty task.";
			const expert = expertBySlug(slug);
			if (expert === void 0) return `No expert named ${slug}. Available: ${knownSlugs()}`;
			if (ctx.subagents.getProvider(provider) === void 0) {
				const available = ctx.subagents.list();
				const hint = available.length === 0 ? "No subagent provider is registered at all." : `Registered providers: ${available.join(", ")}.`;
				return `The subagent provider ${provider} is not registered, so no expert can be summoned. ${hint} Set the plugin's \`provider\` config to one of them.`;
			}
			const capabilities = ctx.subagents.getProvider(provider)?.capabilities;
			const supportsPersona = capabilities?.persona === true;
			const supportsDepth = capabilities?.depthLimit === true;
			const persona = childPersona(expert);
			const run = await ctx.subagents.start(provider, {
				prompt: supportsPersona ? childPrompt(task, background) : childPrompt(task, background, persona),
				parent,
				signal: exec.signal,
				...supportsPersona ? { persona } : {},
				...supportsDepth ? { maxDepth } : {}
			});
			try {
				const result = await run.result;
				const answer = textOf(result.output).trim();
				if (result.stopReason !== "completed") {
					const partial = answer === "" ? "" : `\n\nPartial output before it stopped:\n${answer}`;
					return `Expert ${expert.name} stopped early (${result.stopReason}).${partial}`;
				}
				if (answer === "") return `Expert ${expert.name} returned no text.`;
				return [
					`# ${expert.name}`,
					"",
					answer,
					"",
					"---",
					"This is one specialist perspective, not a verdict. Verify it before relying on it."
				].join("\n");
			} finally {
				await run.dispose();
			}
		}
	}));
}
//#endregion
export { inject as a, PACKAGE as c, settingsSchema as d, EXPERTS as f, childPersona as i, SERVICE as l, apply as n, name as o, catalogPayload as r, INVOCATIONS as s, Config as t, SETTINGS_NAMESPACE as u };
