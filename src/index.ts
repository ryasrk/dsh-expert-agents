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

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the `ctx.subagents` and `ctx.tools` augmentations.
import type {} from '@deepseek-ai/dsh-subagent'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { EXPERTS, expertBySlug, type ExpertDefinition } from './experts.ts'
import { WORKFLOWS, workflowById, workflowIds } from './workflows.ts'
import { SETTINGS_NAMESPACE, settingsSchema } from './contract.ts'

export const name = 'expert-agents'
export const inject = ['tools', 'subagents', 'settings', 'systemPrompt']

/** Plugin config. */
export interface Config {
  /** `ctx.subagents` provider name (default `spawn`). */
  provider: string
  /** How many experts one parent may nest; 1 stops an expert summoning another. */
  maxDepth: number
}

export const Config: z<Config> = z.object({
  provider: z.string().default('spawn'),
  maxDepth: z.natural().default(1),
})

/** The package directory, so assets resolve wherever the plugin is installed. */
const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

/** Where the ported skill bundles live. */
const SKILLS_ROOT = join(PACKAGE_ROOT, 'assets', 'skills')

/** One skill's frontmatter as the catalog presents it. */
interface SkillSummary {
  readonly id: string
  readonly description: string
}

/** Cache of loaded skill summaries, keyed by skill id. */
const skillCache = new Map<string, SkillSummary>()

/**
 * Read one skill's description from its `SKILL.md` frontmatter.
 *
 * The description is what a model reads when deciding whether to load the skill,
 * so it is the one field worth surfacing here; the body is not needed because
 * the child loads skills through its own `skill` tool at run time.
 */
async function loadSkillSummary(id: string): Promise<SkillSummary | undefined> {
  const cached = skillCache.get(id)
  if (cached !== undefined) return cached
  let raw: string
  try {
    raw = await readFile(join(SKILLS_ROOT, id, 'SKILL.md'), 'utf8')
  } catch {
    // A missing bundle is a packaging defect, not a reason to fail the summon.
    // The expert still runs; it simply reports fewer skills than declared.
    return undefined
  }
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(raw)
  const frontmatter = match?.[1]
  if (frontmatter === undefined) return undefined
  const line = frontmatter.split('\n').find(entry => entry.startsWith('description:'))
  const description = line === undefined
    ? id
    : line.slice('description:'.length).trim().replace(/^"|"$/g, '')
  const summary = { id, description }
  skillCache.set(id, summary)
  return summary
}

/** Build the catalog payload the model and the client both render. */
export async function catalogPayload() {
  const rows = []
  for (const expert of EXPERTS) {
    const skills = []
    for (const skill of expert.skills) {
      const summary = await loadSkillSummary(skill.id)
      // A declared skill with no bundle still appears, marked, so the gap is
      // visible rather than silently shrinking the expert's capabilities.
      skills.push({
        id: skill.id,
        why: skill.why,
        description: summary?.description ?? `(bundle missing: ${skill.id})`,
        present: summary !== undefined,
      })
    }
    rows.push({
      slug: expert.slug,
      name: expert.name,
      description: expert.description,
      mandate: expert.mandate,
      skills,
      routes: expert.routes,
    })
  }
  return rows
}

/**
 * The persona one summoned child receives.
 *
 * Built here rather than stored whole because the child needs three things the
 * expert definition alone does not carry: an explicit statement that it is a
 * child, where its skill instructions live, and the instruction not to summon
 * further experts.
 */
export function childPersona(expert: ExpertDefinition): string {
  const skillList = expert.skills.map(skill => skill.id).join(', ')
  return [
    expert.persona,
    '',
    `Your mandate: ${expert.mandate}`,
    '',
    'You are a summoned specialist. The parent session keeps the task, the',
    'judgment, and the final answer; you contribute one perspective and stop.',
    'Do not broaden the task, do not act on adjacent problems you notice, and do',
    'not make decisions that belong to your parent. State what you could not',
    'determine, including anything you were not given enough context to check.',
    '',
    // Every expert persona states where to stop; none states where to keep going,
    // and a specialist that halts on a question its brief already answers costs the
    // parent a full round trip to say "yes, as I asked". Scope and authorisation are
    // different things: the paragraph above narrows the first, this one settles the
    // second, and a child needs both to behave.
    'Finish the work the task already authorises. The brief and its background are',
    'your authorisation: do not stop to ask for permission they have already given,',
    'and do not ask the parent to confirm a step that only carries out what it asked',
    'for. Read-only investigation, and any reversible step needed to reach the',
    'answer, are yours to take. When you genuinely need a decision that is not',
    'yours, do the work that makes that decision concrete first, then state the open',
    'choice and what you would pick.',
    '',
    `Your skill instructions are available through the skill tool: ${skillList}.`,
    'Load one when it matches the work rather than working from its name.',
  ].join('\n')
}

/** Build the child's user message from the task and optional background. */
function childPrompt(task: string, background: string, persona?: string): ContentBlock[] {
  const body = background === ''
    ? task
    : `${task}\n\nBackground (already settled; do not re-litigate it):\n${background}`
  // A provider without persona support gets the brief at the top of its prompt
  // instead, separated so it reads as standing instruction rather than as part
  // of the task.
  const text = persona === undefined
    ? body
    : `${persona}\n\n---\n\n${body}`
  return [{ type: 'text', text }]
}

/** Pull plain text out of a child's returned content blocks. */
function textOf(blocks: readonly ContentBlock[] | undefined): string {
  if (blocks === undefined) return ''
  return blocks
    .map(block => (block.type === 'text' ? block.text : ''))
    .filter(text => text !== '')
    .join('')
}

/** The slugs a caller may summon, for an error message. */
function knownSlugs(): string {
  return EXPERTS.map(expert => expert.slug).join(', ')
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
function enabledSlugs(ctx: Context): string[] {
  const fallback = EXPERTS.map(expert => expert.slug)
  const settings = (ctx as { settings?: { get(ns: string): unknown } }).settings
  if (settings === undefined) return fallback
  let stored: unknown
  try {
    stored = settings.get(SETTINGS_NAMESPACE)
  } catch {
    return fallback
  }
  const enabled = (stored as { enabled?: unknown } | undefined)?.enabled
  if (!Array.isArray(enabled)) return fallback
  // Intersect with the roster so a stale slug in the document cannot be
  // reported as a live stage owner.
  const known = new Set(fallback)
  return enabled.filter((slug): slug is string => typeof slug === 'string' && known.has(slug))
}

export function apply(ctx: Context, config: Config = {} as Config): void {
  const provider = config.provider ?? 'spawn'
  const maxDepth = config.maxDepth ?? 1

  // Routing between these three tools is comparative, so it belongs in a prompt
  // section rather than in any one description: a tool cannot usefully describe when
  // its sibling is the better call. The text is a function of scope so a deployment
  // that mounts the plugin without these tools registered carries no rules about
  // them. The order sits just past TOOL_SUBAGENT (2800) in the repository's table,
  // which is the family this belongs to; a third-party plugin cannot take a name from
  // `getSectionOrder`, so the number is written out.
  ctx.systemPrompt.section({
    name: 'tool:expert-agents',
    order: 2850,
    text: ({ scope }: { scope?: unknown }) => {
      const has = (tool: string): boolean => ctx.tools.get(tool, scope as never) !== undefined
      if (!has('summon_expert') && !has('plan_workflow')) return ''
      const lines: string[] = []
      if (has('plan_workflow') && has('summon_expert')) {
        lines.push(
          'Use plan_workflow to decide which stages a piece of work needs, and '
          + 'summon_expert to run one. Reach for plan_workflow when the request is an '
          + 'outcome rather than a defined task; skip it when the work is one clear '
          + 'job and summon that expert directly. Planning a two-stage change is '
          + 'overhead, not rigour.',
        )
      }
      if (has('summon_expert')) {
        lines.push(
          'An expert is a scoping device, not a sandbox: it runs with the same '
          + 'privileges you do. Summon one when a task genuinely needs a different '
          + 'standing brief, not to obtain permission or to split work you can do in '
          + 'one pass.',
        )
      }
      return lines.join(' ')
    },
  })

  ctx.tools.register(defineTool({
    name: 'list_experts',
    description:
      'List the domain experts available to summon, with what each one owns and '
      + 'which seat it hands work to. Use this before summoning when you are not '
      + 'sure which expert fits, or when the user asks what experts exist. This '
      + 'call is read-only and starts nothing.',
    parameters: {
      slug: {
        type: 'string',
        description: 'One expert slug to describe in full; omit for the whole roster.',
      },
    },
    output: {
      schema: { type: 'string' },
      render: (_args: unknown, value: unknown) => [{ type: 'text', text: String(value) }],
    },
    async execute(args: { slug?: string }) {
      if (typeof args.slug === 'string' && args.slug !== '') {
        const expert = expertBySlug(args.slug)
        if (expert === undefined) {
          return `No expert named ${args.slug}. Available: ${knownSlugs()}`
        }
        const rows = await catalogPayload()
        const row = rows.find(entry => entry.slug === expert.slug)
        return [
          `${expert.name} (${expert.slug})`,
          expert.description,
          '',
          `Mandate: ${expert.mandate}`,
          '',
          'Skills:',
          ...(row?.skills ?? []).map(
            skill => `  ${skill.present ? '' : '(missing) '}${skill.id}: ${skill.description}`),
          '',
          'Hands off to:',
          ...expert.routes.map(route => `  ${route.need} -> ${route.to}`),
        ].join('\n')
      }

      return [
        `The same ${EXPERTS.length} experts are available. Summon one by slug with summon_expert.`,
        '',
        'slug\tname\tdescription',
        ...EXPERTS.map(expert =>
          `${expert.slug}\t${expert.name}\t${expert.description}`),
        '',
        'An expert answers and stops; you keep the task and the final answer.',
      ].join('\n')
    },
  }))

  ctx.tools.register(defineTool({
    name: 'plan_workflow',
    description:
      'Get the stage chain for a piece of work, as a routing table of which expert '
      + 'owns each stage and what each stage must produce. Call this before starting '
      + 'multi-stage work, and again when the shape of the work changes. The chain '
      + 'scales to the work: a small change runs two stages, not six. Use it when the '
      + 'request is a business outcome rather than a defined feature, and when you are '
      + 'unsure whether the work needs discovering, designing, or just building. '
      + 'Passing no workflow returns the index of templates so you can pick one.',
    parameters: {
      workflow: {
        type: 'string',
        description:
          'Template id: business, feature, bug, small, or parallel. Omit to see the index '
          + 'and the rules for choosing between them.',
      },
    },
    output: {
      schema: { type: 'string' },
      render: (_args: unknown, value: unknown) => [{ type: 'text', text: String(value) }],
    },
    async execute(args: { workflow?: string }) {
      if (typeof args.workflow !== 'string' || args.workflow === '') {
        return [
          `${WORKFLOWS.length} workflow templates. Ask what is actually undecided:`,
          '',
          'workflow\tstages\tuse when',
          ...WORKFLOWS.map(w =>
            `${w.id}\t${w.stages.length}\t${w.useWhen}`),
          '',
          'The process itself undecided -> business.',
          'Requirements undecided -> feature, starting at design.',
          'Mechanism undecided -> bug.',
          'Steps undecided only -> feature, starting at plan.',
          'Nothing undecided -> small.',
          'Several of the above, independently -> parallel.',
          '',
          'The common failure is reaching for feature because the work feels '
          + 'important. If the requirements, the mechanism, and the steps are all '
          + 'settled, importance does not make the extra stages catch anything. '
          + 'Call plan_workflow with an id for the full chain.',
        ].join('\n')
      }

      const template = workflowById(args.workflow)
      if (template === undefined) {
        return `No workflow named ${args.workflow}. Available: ${workflowIds().join(', ')}.`
      }

      // enabledSlugs returns the slugs that ARE enabled, so a stage owner
      // missing from it is the disabled case.
      const enabled = new Set(enabledSlugs(ctx))
      const lines = [
        `${template.name} workflow: ${template.useWhen}`,
        '',
        `Entry gate: ${template.entryGate}`,
        '',
        'stages:',
      ]
      template.stages.forEach((stage, index) => {
        const owner = stage.owner === null
          ? 'you (the orchestrator)'
          : expertBySlug(stage.owner)?.name ?? stage.owner
        const gated = stage.owner !== null && !enabled.has(stage.owner)
          ? ` [${stage.owner} is disabled in settings; re-enable it or do this stage yourself]`
          : ''
        const fan = stage.fanOut === undefined ? '' : `, up to ${stage.fanOut} in parallel`
        lines.push(
          `  ${index + 1}. ${stage.label}${fan} -> ${owner}${gated}`,
          `     produces: ${stage.produces}`,
          `     catches: ${stage.catches}`,
        )
      })
      lines.push(
        '',
        'Stop for a human only for:',
        ...template.stopConditions.map(condition => `  - ${condition}`),
        '',
        'Everything else you rule on and record. Summon each owned stage with '
        + 'summon_expert, writing a brief that stands alone: the stage expert does '
        + 'not see this conversation, and the review and verify stages must not '
        + 'receive the producer narrative, or they inherit its reasoning and '
        + 'approve it.',
      )
      return lines.join('\n')
    },
  }))

  ctx.tools.register(defineTool({
    name: 'summon_expert',
    description:
      'Summon one domain expert as a specialist subagent and get its answer. The '
      + 'expert receives only the task you write, so give it a standalone prompt: '
      + 'it does not see this conversation. Use list_experts first if you are '
      + 'unsure which expert fits. The expert answers one question or produces one '
      + 'artifact and stops; you keep the task context and the final answer, so '
      + 'verify what it returns before relying on it.',
    parameters: {
      expert: {
        type: 'string',
        required: true,
        description: 'The expert slug, from list_experts.',
      },
      task: {
        type: 'string',
        required: true,
        description:
          'The complete, standalone task for the expert. Include the workspace, '
          + 'the exact artifact or question, and what you want returned.',
      },
      context: {
        type: 'string',
        description:
          'Optional background the expert needs but that is not part of the task '
          + 'itself: decisions already made, constraints, what has been tried.',
      },
    },
    output: {
      schema: { type: 'string' },
      render: (_args: unknown, value: unknown) => [{ type: 'text', text: String(value) }],
    },
    async execute(args, exec) {
      const parent = exec.agent
      if (parent === undefined) {
        return 'summon_expert needs a running agent to spawn from; none is in scope.'
      }
      const slug = String(args.expert ?? '')
      const task = String(args.task ?? '').trim()
      const background = typeof args.context === 'string' ? args.context.trim() : ''

      if (task === '') return 'summon_expert needs a non-empty task.'
      const expert = expertBySlug(slug)
      if (expert === undefined) {
        return `No expert named ${slug}. Available: ${knownSlugs()}`
      }
      if (ctx.subagents.getProvider(provider) === undefined) {
        // Naming the registered providers turns an unactionable failure into a
        // correction the caller can make in one step.
        const available = ctx.subagents.list()
        const hint = available.length === 0
          ? 'No subagent provider is registered at all.'
          : `Registered providers: ${available.join(', ')}.`
        return `The subagent provider ${provider} is not registered, so no expert can `
          + `be summoned. ${hint} Set the plugin's \`provider\` config to one of them.`
      }

      // The service rejects a request naming a capability the provider does not
      // advertise, so `persona` and `maxDepth` are sent only when supported. A
      // provider that lacks them still gets the persona text, folded into the
      // prompt instead, because an expert without its brief is not that expert.
      const capabilities = ctx.subagents.getProvider(provider)?.capabilities
      const supportsPersona = capabilities?.persona === true
      const supportsDepth = capabilities?.depthLimit === true
      const persona = childPersona(expert)

      const run = await ctx.subagents.start(provider, {
        prompt: supportsPersona
          ? childPrompt(task, background)
          : childPrompt(task, background, persona),
        parent,
        signal: exec.signal,
        ...(supportsPersona ? { persona } : {}),
        // `maxDepth: 1` means the child may not start a grandchild, so an expert
        // cannot summon another expert even if its persona failed to say so.
        // Only sent when the provider advertises the depth limit.
        ...(supportsDepth ? { maxDepth } : {}),
      })
      try {
        const result = await run.result
        const answer = textOf(result.output).trim()

        if (result.stopReason !== 'completed') {
          const partial = answer === ''
            ? ''
            : `\n\nPartial output before it stopped:\n${answer}`
          return `Expert ${expert.name} stopped early (${result.stopReason}).${partial}`
        }
        if (answer === '') {
          return `Expert ${expert.name} returned no text.`
        }
        return [
          `# ${expert.name}`,
          '',
          answer,
          '',
          '---',
          'This is one specialist perspective, not a verdict. Verify it before relying on it.',
        ].join('\n')
      } finally {
        // Idempotent, and the release matters for a local run: the child session
        // stays alive otherwise, one per summon.
        await run.dispose()
      }
    },
  }))
}
