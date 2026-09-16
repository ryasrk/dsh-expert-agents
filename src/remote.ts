/**
 * Remote half: the Host service the Settings page reads and writes.
 *
 * The client cannot read Host state directly. It calls a Remote service, and the
 * api-gateway routes that call by looking the service up in the ROOT service
 * table. That is why `cordis.patch.yml` registers this as its own top-level row
 * rather than nesting it inside the main plugin: a Remote registration inside
 * another plugin's scope is invisible to the gateway, and the Settings page then
 * reports a service it cannot reach.
 *
 * Enabled experts live in DSH settings rather than in this plugin's config, so
 * the choice is revisioned, conflict-checked, and visible to the user. The
 * revision is compared on every write: if the stored revision moved since the
 * client read it, the write is rejected rather than silently clobbering a change
 * made elsewhere (a second tab, or a hand edit of the settings file).
 *
 * @module dsh-expert-agents/remote
 */

import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the `ctx.settings` and `ctx.typert` augmentations.
import type {} from '@deepseek-ai/dsh-settings'
import type { TypertContribution } from '@deepseek-ai/dsh-typert-registry'
import { catalogPayload } from './index.ts'
import { EXPERTS } from './experts.ts'
import { INVOCATIONS, PACKAGE, SETTINGS_NAMESPACE, SERVICE, settingsSchema } from './contract.ts'

/**
 * A minimal `parse`-shaped wrapper over a schemastery schema.
 *
 * The Typert codec contract requires `{ parse(value) }`, while schemastery
 * validates through Standard Schema. Wrapping keeps one schema definition
 * instead of a parallel hand-written validator, so a field added here is
 * validated at the boundary without a second edit.
 */
function codec<Output>(schema: {
  '~standard': {
    validate(value: unknown): unknown
  }
}): { parse(value: unknown): Output } {
  return {
    parse(value: unknown): Output {
      // Standard Schema permits an async validator; these schemas are all
      // synchronous, so an async result is a programming error rather than a
      // value to await at a synchronous codec boundary.
      const result = schema['~standard'].validate(value) as
        | { value: Output }
        | { issues: readonly unknown[] }
      if ('issues' in result) {
        // The codec contract has no issue channel, so a rejected boundary value
        // must throw. JSON-stringifying the issues keeps the path visible.
        throw new TypeError(`expert-agents codec rejected a value: ${JSON.stringify(result.issues)}`)
      }
      return result.value
    },
  }
}

/**
 * The Typert contribution.
 *
 * The invocation descriptors come from the shared contract module rather than
 * being written here, so the ids the gateway routes and the ids the client
 * mounts cannot drift apart.
 */
const TYPERT: TypertContribution = {
  package: PACKAGE,
  face: 'host',
  schemas: [],
  model: { services: [], events: [], objects: [] },
  invocations: INVOCATIONS,
}

/** The default set: every expert enabled, so a fresh install is usable. */
const DEFAULT_ENABLED = EXPERTS.map(expert => expert.slug)


export default class ExpertAgentsRemote extends TypertRemoteService {
  static inject = ['settings', 'typert']

  /** The registered namespace handle, present once `settings` is available. */
  private settings: { get(): { enabled: string[] } } | undefined

  constructor(ctx: Context) {
    super(ctx, SERVICE)
    ctx.typert.register(TYPERT)
    // Registering the namespace is what makes it readable and writable:
    // `settings.get` returns undefined for an unregistered namespace, and
    // `settings.mutate` rejects one. The base supplies the default so a fresh
    // install needs no stored document.
    ctx.inject(['settings'], settingsCtx => {
      this.settings = settingsCtx.settings.register(
        SETTINGS_NAMESPACE,
        settingsSchema,
        { base: { enabled: [...DEFAULT_ENABLED] } },
      )
    })
  }

  /**
   * The enabled set, plus the revision a writer must echo back.
   *
   * An unset namespace means a fresh install, and a fresh install enables the
   * whole roster: an expert the user has to discover and switch on is an expert
   * that does not get used. Intersecting the stored value with the current
   * roster means removing an expert from the plugin does not leave a slug in
   * settings that resolves to nothing.
   */
  async getState() {
    const known = new Set(DEFAULT_ENABLED)
    const stored = this.settings?.get()?.enabled
    const enabled = Array.isArray(stored)
      ? stored.filter((slug): slug is string => typeof slug === 'string' && known.has(slug))
      : DEFAULT_ENABLED
    return { enabled, revision: this.revision(), experts: await catalogPayload() }
  }

  /**
   * Replace the enabled set, rejecting the write if the stored revision moved.
   *
   * Enabling nothing is allowed and is the way to silence the roster without
   * uninstalling it. Unknown slugs are dropped rather than stored, so a stale
   * client cannot introduce one.
   */
  async setEnabled(enabled: string[], expectedRevision: number) {
    const known = new Set(DEFAULT_ENABLED)
    const clean = [...new Set(enabled.filter(slug => known.has(slug)))]
    await this.ctx.settings.mutate(
      SETTINGS_NAMESPACE,
      [{ op: 'set', path: ['enabled'], value: clean }],
      expectedRevision,
    )
    return await this.getState()
  }

  /** The current revision of this plugin's settings namespace. */
  private revision(): number {
    const descriptor = this.ctx.settings
      .describe()
      .find(candidate => candidate.ns === SETTINGS_NAMESPACE)
    if (descriptor === undefined) {
      // The namespace only appears once something is stored. Revision 0 is
      // correct for that state, and a read must not fail over it.
      return 0
    }
    return descriptor.revision
  }
}
