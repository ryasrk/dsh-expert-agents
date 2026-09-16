/**
 * Workflow templates: the stage chains, expressed as which expert owns each
 * stage.
 *
 * A template is a routing table, not a script. It names the stages in order and
 * the expert that fills each, so the orchestrator knows who to summon next and
 * what the stage must produce. Nothing here calls an expert: the orchestrator
 * does, through `summon_expert`.
 *
 * Four chains rather than one, because the stage count is a cost. The evidence
 * for that, and for why each stage exists, is `docs/workflow-research.md`; the
 * human-readable guide is `docs/workflow-templates.md`.
 *
 * A stage's `owner` is an expert slug, or `null` for a stage the orchestrator
 * performs itself: integrating a parallel fan-out and ruling on ambiguities are
 * coordination work, and delegating them would put the routing decision inside a
 * child that cannot see the other children.
 */

/** One stage of a chain. */
export interface WorkflowStage {
  /** Stable id within the template; the machine-facing name. */
  readonly id: string
  /** What this stage is called in the picker and reports. */
  readonly label: string
  /**
   * Expert slug that owns the stage, or `null` when the orchestrator does it.
   * A non-null value is validated against the roster at load time, so a rename
   * fails loudly rather than silently routing to nobody.
   */
  readonly owner: string | null
  /** The one thing this stage must produce before the next one starts. */
  readonly produces: string
  /** Why this stage exists; the defect it catches that no other stage can. */
  readonly catches: string
  /** How many times this stage fans out, for the parallel template only. */
  readonly fanOut?: number
}

/**
 * One template.
 *
 * `entryGate` is the condition that must hold before the chain is valid, and
 * `stopConditions` are the only reasons the orchestrator halts for a human.
 * Both are rendered into the tool result so the orchestrator gets the rules at
 * the moment it picks the template, rather than having to have memorised them.
 */
export interface WorkflowTemplate {
  /** Stable id; the `workflow` argument to the tool. */
  readonly id: string
  /** Human-facing name. */
  readonly name: string
  /** One sentence: what shape of work this chain is for. */
  readonly useWhen: string
  /** The condition that must hold before this chain is valid at all. */
  readonly entryGate: string
  /** The stages, in order. */
  readonly stages: readonly WorkflowStage[]
  /** The only reasons to stop for a human. */
  readonly stopConditions: readonly string[]
}

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
const STOP_CONDITIONS: readonly string[] = [
  'An irreversible or destructive operation.',
  'A security-sensitive action.',
  'A side effect outside the workspace that norms say you ask about first: a push to a shared branch, a publish, a merge.',
  'A plan so broken that every path forward is a guess.',
]

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
export const WORKFLOWS: readonly WorkflowTemplate[] = [
  {
    id: 'business',
    name: 'Business process',
    useWhen:
      'The request arrives as a business outcome rather than a defined feature: a metric to move, a complaint, a regulation to satisfy.',
    entryGate:
      'The outcome can be stated as something measurable. If it cannot, that is the first finding, and the discovery stage is where it gets fixed: a process mapped against an unmeasurable goal produces a model nobody can evaluate.',
    stopConditions: STOP_CONDITIONS,
    stages: [
      {
        id: 'discover',
        label: 'Map the process',
        owner: 'discover',
        produces:
          'An as-is map in the business vocabulary: every step with its actor, trigger, input, output, time, and failure mode, plus the workarounds that run beside the system of record.',
        catches:
          'Building against the request as stated. The requester describes the process they believe runs, or the one they wish ran; the workarounds describe the one that does. This stage is the only place that gap is visible before code exists.',
      },
      {
        id: 'find-gaps',
        label: 'Find the gaps',
        owner: 'discover',
        produces:
          'Each finding classified and evidenced: redundancy, handoff, bottleneck, workaround, missing feedback, control gap.',
        catches:
          'Treating a queueing problem as a speed problem, and automating a step that should instead be removed. An automated step that should not exist is worse than a manual one, because it runs faster and produces more.',
      },
      {
        id: 'to-be',
        label: 'Propose the to-be',
        owner: 'discover',
        produces:
          'One proposal per gap, each naming the metric it moves, what stays manual and why, and what must be true first.',
        catches:
          'Proposals that cannot be evaluated. A change with no metric cannot be rejected, so it gets built by default.',
      },
      {
        id: 'scope',
        label: 'Settle the design',
        owner: 'design',
        produces:
          'The module boundary, the domain terms, and the decisions expensive to reverse, from the settled to-be.',
        catches:
          'A to-be implemented straight from the proposal, with an unfixed scope and a data shape nobody decided.',
      },
      {
        id: 'plan',
        label: 'Plan',
        owner: 'plan',
        produces:
          'A plan file: bite-sized tasks naming the files, the checks, and how to run them.',
        catches: 'A missing step, while it is still one line in a document.',
      },
      {
        id: 'verify',
        label: 'Verify',
        owner: 'test',
        produces:
          'Evidence that the delivered change moves the metric the to-be named, not merely that the code runs.',
        catches:
          'A system that ships exactly as specified and does not change the outcome the discovery was commissioned for. This is the failure the whole chain exists to prevent.',
      },
    ],
  },
  {
    id: 'feature',
    name: 'Feature',
    useWhen:
      'The work spans sessions, crosses a module boundary, or reverses a decision.',
    entryGate:
      'A settled spec exists. If the difficulty is undecided requirements rather than undecided steps, run the design stage first: planning against unsettled requirements plans the wrong thing.',
    stopConditions: STOP_CONDITIONS,
    stages: [
      {
        id: 'design',
        label: 'Design',
        owner: 'design',
        produces: 'A settled spec: the module boundary, the domain terms, and the decisions expensive to reverse.',
        catches:
          'Undecided requirements, before they are encoded in a plan that assumes an answer.',
      },
      {
        id: 'plan',
        label: 'Plan',
        owner: 'plan',
        produces:
          'A plan file: bite-sized tasks naming the files, the checks, and how to run them, written for an executor with none of your context.',
        catches: 'A missing step, while it is still one line in a document.',
      },
      {
        id: 'plan-review',
        label: 'Plan review',
        owner: 'review',
        produces: 'A verdict on the plan plus the defects found, before any code exists.',
        catches:
          'A plan an outsider cannot execute. This is the cheapest gate in the chain: a plan defect costs one revision, the same defect found during implementation costs the implementation.',
      },
      {
        id: 'implement',
        label: 'Implement',
        owner: null,
        produces: 'The change, one task at a time, each task run to a check that passes.',
        catches:
          'Nothing; it produces. Per task rather than per plan, so a failed task does not invalidate the tasks after it.',
      },
      {
        id: 'review',
        label: 'Review',
        owner: 'review',
        produces: 'Two-axis review: spec compliance, then code quality, each with the evidence behind it.',
        catches:
          'Author bias, spec drift, and unstated assumptions. The reviewer must receive the artifact and the spec and not the implementer narrative, or it inherits the author justifications and approves them.',
      },
      {
        id: 'verify',
        label: 'Verify',
        owner: 'test',
        produces: 'The raw output of the commands that prove the claim, run fresh in this stage.',
        catches:
          'Claims that do not match reality. The verifier did not produce the artifact, which is what makes its evidence worth having.',
      },
    ],
  },
  {
    id: 'bug',
    name: 'Bug',
    useWhen: 'It starts from a failure rather than a feature.',
    entryGate:
      'The symptom is reproducible. If it is not, the diagnosis stage is where that gets established, and the chain still starts here.',
    stopConditions: STOP_CONDITIONS,
    stages: [
      {
        id: 'diagnose',
        label: 'Diagnose',
        owner: 'diagnose',
        produces:
          'A stated mechanism: why the defect occurs, plus a failing check that reproduces it. That check becomes the verification for this chain.',
        catches:
          'Symptom fixes. A fix planned without the mechanism is a fix planned for the wrong defect, and if the stage cannot name why the defect occurs it is not done, however plausible the candidate fix looks.',
      },
      {
        id: 'implement',
        label: 'Implement',
        owner: null,
        produces: 'The root-cause fix, which turns the reproducing check green.',
        catches: 'Nothing; it produces.',
      },
      {
        id: 'verify',
        label: 'Verify',
        owner: 'test',
        produces:
          'The reproducing check run green, plus evidence that the rest of the suite still passes.',
        catches:
          'A fix that moved the failure rather than removing it, which is the characteristic failure of this chain.',
      },
    ],
  },
  {
    id: 'small',
    name: 'Small change',
    useWhen: 'One task, one file, nothing reversed.',
    entryGate:
      'All three must hold: one file or one cohesive edit; nothing reversed; the change is explainable in a sentence. If any fails, use the feature chain.',
    stopConditions: STOP_CONDITIONS,
    stages: [
      {
        id: 'implement',
        label: 'Implement',
        owner: null,
        produces: 'The edit.',
        catches: 'Nothing; it produces.',
      },
      {
        id: 'verify',
        label: 'Verify',
        owner: 'test',
        produces: 'The check that covers the edit, run and read.',
        catches:
          'The gap between the change and the claim. The shortened chain drops the planning and review stages, not the evidence requirement.',
      },
    ],
  },
  {
    id: 'parallel',
    name: 'Parallel',
    useWhen: 'Independent subtasks that share no files.',
    entryGate:
      'Independence must be checked, not assumed: each subtask understandable without any other context, and no two subtasks touching the same files. Two failures with one root cause are related, not independent; running them in parallel burns a second agent to rediscover the first finding. Shared state means run it sequentially instead.',
    stopConditions: STOP_CONDITIONS,
    stages: [
      {
        id: 'decompose',
        label: 'Decompose',
        owner: null,
        produces: 'A grouping by what is broken, not by which file was touched.',
        catches: 'Related failures masquerading as independent ones, before they are dispatched.',
      },
      {
        id: 'fan-out',
        label: 'Fan out',
        owner: null,
        fanOut: 3,
        produces:
          'One self-contained brief per independent domain, each naming the scope, the goal, the constraint, and the expected return, dispatched together.',
        catches:
          'Sequential investigation of unrelated problems. Each expert gets its own context because it inherits none of yours, so the brief has to stand alone.',
      },
      {
        id: 'integrate',
        label: 'Integrate',
        owner: null,
        produces: 'The merged result, with conflicts resolved by the orchestrator.',
        catches:
          'Conflicting edits. This stage stays with the orchestrator: routing the merge into a child would put the decision inside an agent that cannot see the other children.',
      },
      {
        id: 'verify',
        label: 'Verify',
        owner: 'test',
        produces: 'The full check across the integrated result, not per-subtask.',
        catches: 'The failures that only appear once the independently-correct pieces meet.',
      },
    ],
  },
]

/** Look up a template by id. */
export function workflowById(id: string): WorkflowTemplate | undefined {
  return WORKFLOWS.find((w) => w.id === id)
}

/** The template ids, for the tool's validation message. */
export function workflowIds(): string[] {
  return WORKFLOWS.map((w) => w.id)
}
