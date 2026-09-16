/**
 * Client half: the Experts settings section.
 *
 * One page in Settings, registered on the `settings.section` list slot at an
 * order placing it just after Agent presets: presets choose the session's
 * composition and this page chooses which experts that session may summon, so
 * they belong next to each other.
 *
 * It reads and writes through the Remote service rather than touching Host
 * state, and holds the revision it read so two open tabs cannot overwrite each
 * other's change.
 *
 * @module dsh-expert-agents/client
 */

import { useCallback, useEffect, useState } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the `ctx.remote` merge and the generated descriptor face.
// Type-only: each pulls its package's `declare module '@deepseek-ai/cordis'`
// augmentation, which is what puts `slots`, `remote` and the generated
// `remote.<service>` faces on ClientContext. Without them the code compiles
// against a Context that has neither, and every call reads as an error.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { INVOCATIONS, PACKAGE } from '../contract.ts'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// `ctx.slots` is declared by the renderer, not by the slots package itself.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-typert-registry/client'

/** One skill as the detail view lists it. */
interface SkillRow {
  readonly id: string
  readonly why: string
  readonly description: string
  readonly present: boolean
}

/** One expert as the page lists it. */
interface ExpertRow {
  readonly slug: string
  readonly name: string
  readonly description: string
  readonly mandate: string
  readonly skills: readonly SkillRow[]
  readonly routes: readonly { readonly need: string; readonly to: string }[]
}

/** What the Remote service reports. */
interface ExpertState {
  readonly enabled: readonly string[]
  readonly revision: number
  readonly experts: readonly ExpertRow[]
}

/**
 * The client-side Remote descriptors, from the shared contract.
 *
 * `$mount` uses them to install the `remote.expertAgents` namespace service;
 * without a mount that namespace does not exist and every call below reads as a
 * missing method.
 */
const REMOTE_CONTRIBUTION: TypertRemoteContribution = {
  package: PACKAGE,
  descriptors: INVOCATIONS,
}

/**
 * The `remote.expertAgents` face this section calls.
 *
 * Declared here because the namespace is installed at run time by `$mount`, so
 * no ambient augmentation describes it.
 */
interface ExpertAgentsRemoteFace {
  getState(): Promise<RemoteResult<ExpertState>>
  setEnabled(enabled: string[], expectedRevision: number): Promise<RemoteResult<ExpertState>>
}

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'remote']

/**
 * The section component.
 *
 * `ctx` is captured rather than threaded through slot props: the Remote face is
 * a plugin-lifetime handle, and passing it as a prop would make the component
 * re-read a mutable lookup on every render.
 */
function ExpertAgentsSection({ ctx, remote }: {
  readonly ctx: ClientContext
  readonly remote: ExpertAgentsRemoteFace
}) {
  return function ExpertAgentsSectionView() {
    const [state, setState] = useState<ExpertState | undefined>(undefined)
    const [error, setError] = useState<string | undefined>(undefined)
    const [busy, setBusy] = useState(false)
    const [openSlug, setOpenSlug] = useState<string | undefined>(undefined)

    const refresh = useCallback(async () => {
      const result = await remote.getState()
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setState(result.value)
      setError(undefined)
    }, [])

    useEffect(() => { void refresh() }, [refresh])

    /**
     * Persist one change.
     *
     * The revision from the last read travels with the write, so a write that
     * lost a race is rejected rather than silently discarding the other change.
     * On rejection the page reloads and says so: reporting success for a write
     * that did not land is the one outcome worth failing loudly over.
     */
    const commit = useCallback(async (next: string[]) => {
      if (state === undefined) return
      setBusy(true)
      try {
        const result = await remote.setEnabled(next, state.revision)
        if (!result.ok) {
          setError(`${result.error.message} The list was reloaded; reapply the change.`)
          await refresh()
          return
        }
        setState(result.value)
        setError(undefined)
      } finally {
        setBusy(false)
      }
    }, [state, refresh])

    const title = <h2 key="title" className="ea-title">Experts</h2>

    if (state === undefined) {
      return (
        <div className="ea-section">
          {title}
          {error === undefined
            ? <p className="ea-muted">Loading experts…</p>
            : <p className="ea-error" role="alert">{error}</p>}
        </div>
      )
    }

    const enabled = new Set(state.enabled)
    const allSlugs = state.experts.map(expert => expert.slug)
    const toggle = (slug: string) => {
      const next = new Set(enabled)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      // Emitted in roster order, so the stored array reads the way the page does.
      return allSlugs.filter(candidate => next.has(candidate))
    }

    return (
      <div className="ea-section">
        {title}
        <p className="ea-muted">
          {`${state.enabled.length} of ${state.experts.length} enabled. `}
          A model can summon an enabled expert with the summon_expert tool. The
          expert answers one question and stops; this session keeps the task, the
          judgment, and the final answer.
        </p>
        {error === undefined ? null : <p className="ea-error" role="alert">{error}</p>}

        <div className="ea-actions">
          <button
            type="button"
            className="ea-button"
            disabled={busy || state.enabled.length === state.experts.length}
            onClick={() => void commit(allSlugs)}
          >
            Enable all
          </button>
          <button
            type="button"
            className="ea-button"
            disabled={busy || state.enabled.length === 0}
            onClick={() => void commit([])}
          >
            Disable all
          </button>
        </div>

        <ul className="ea-list">
          {state.experts.map(expert => {
            const on = enabled.has(expert.slug)
            const open = openSlug === expert.slug
            return (
              <li key={expert.slug} className={on ? 'ea-row ea-row-on' : 'ea-row'}>
                <div className="ea-head">
                  <label className="ea-label">
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={busy}
                      onChange={() => void commit(toggle(expert.slug))}
                    />
                    <span className="ea-headtext">
                      <strong className="ea-name">{expert.name}</strong>
                      <span className="ea-desc">{expert.description}</span>
                    </span>
                  </label>
                  <button
                    type="button"
                    className="ea-more"
                    aria-expanded={open}
                    onClick={() => setOpenSlug(open ? undefined : expert.slug)}
                  >
                    {open ? 'Hide detail' : 'Detail'}
                  </button>
                </div>
                {!open ? null : (
                  <div className="ea-detail">
                    <p className="ea-mandate">{expert.mandate}</p>
                    <h4 className="ea-h4">{`Skills (${expert.skills.length})`}</h4>
                    <ul className="ea-skills">
                      {expert.skills.map(skill => (
                        <li key={skill.id} className="ea-skill">
                          <code className="ea-code">{skill.id}</code>
                          <span className="ea-skilldesc">
                            {skill.present
                              ? ` ${skill.description}`
                              : ` (bundle missing: ${skill.id})`}
                          </span>
                          <em className="ea-why">{skill.why}</em>
                        </li>
                      ))}
                    </ul>
                    <h4 className="ea-h4">Hands off to</h4>
                    <ul className="ea-routes">
                      {expert.routes.map(route => (
                        <li key={route.need} className="ea-route">
                          {`${route.need} → ${route.to}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    )
  }
}

/**
 * Register the Experts page.
 *
 * The registration is wrapped in `slots.inject` so the section is re-registered
 * when the settings shell is replaced (a hot reload, or a shell that mounts
 * after this plugin), instead of registering once into a slot that may not exist
 * yet and silently rendering nothing.
 *
 * @param ctx - the browser plugin context.
 */
export async function apply(ctx: ClientContext): Promise<void> {
  // Mounting is what creates `remote.expertAgents`; the namespace does not
  // exist until this resolves, and the page would render an empty roster
  // against a missing method if it were registered first.
  await ctx.remote.$mount(REMOTE_CONTRIBUTION)
  const remote = ctx.get('remote.expertAgents') as ExpertAgentsRemoteFace | undefined
  if (remote === undefined) {
    // Loud on purpose: a silently unmounted namespace renders a page that looks
    // like an empty roster, which is the failure this check exists to prevent.
    throw new Error('dsh-expert-agents: remote.expertAgents did not mount')
  }
  const Section = ExpertAgentsSection({ ctx, remote })
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'expert-agents',
    order: 22,
    label: 'Experts',
  }, Section))
}
