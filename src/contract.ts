/**
 * The expert-agents wire contract, shared by both halves.
 *
 * The Host declares these schemas to validate what leaves the service; the
 * client declares the same ones to validate what arrives. Both are derived from
 * one definition so a field added here cannot be validated on one side and
 * silently dropped on the other, which is the failure a hand-copied second
 * contract produces.
 *
 * The module is imported by the Node half and the browser half. It must stay
 * free of `node:` imports and of any Host-only service for that reason.
 *
 * @module dsh-expert-agents/contract
 */

import type { TypertCodec, TypertSchema } from '@deepseek-ai/dsh-typert-protocol'
import z from '@deepseek-ai/schemastery'

/** Settings namespace this plugin owns. */
export const SETTINGS_NAMESPACE = 'expert-agents'

/** Package name, stamped into every invocation id. */
export const PACKAGE = 'dsh-expert-agents'

/** The service name, which is also its Remote namespace. */
export const SERVICE = 'expertAgents'

/** One skill as both halves describe it. */
export const skillSchema = z.object({
  id: z.string(),
  why: z.string(),
  description: z.string(),
  present: z.boolean(),
})

/** One expert as both halves describe it. */
export const expertSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  mandate: z.string(),
  skills: z.array(skillSchema),
  routes: z.array(z.object({ need: z.string(), to: z.string() })),
})

/**
 * The full state payload.
 *
 * The roster travels with every read rather than being fetched separately: it is
 * fixed for a given install, so it costs one small payload and spares the client
 * a second call whose failure mode (a silently empty page) would look like a bug
 * in the write path.
 */
export const stateSchema = z.object({
  enabled: z.array(z.string()),
  revision: z.natural(),
  experts: z.array(expertSchema),
})

/** The enabled set a writer sends. */
export const enabledSchema = z.array(z.string())

/**
 * The stored settings shape.
 *
 * `enabled` is the whole of this plugin's user state. It is a settings field
 * rather than plugin config so the choice persists across restarts, is
 * revisioned for conflict detection, and can be edited by hand.
 */
export const settingsSchema = z.object({
  enabled: z.array(z.string()),
})

/**
 * Wrap a schemastery schema in the `{ parse }` shape a codec requires.
 *
 * Schemastery validates through Standard Schema, whose result may be async;
 * these schemas are all synchronous, so an async result is a programming error
 * rather than something to await at a synchronous codec boundary.
 */
function parser<Output>(schema: {
  '~standard': { validate(value: unknown): unknown }
}): { parse(value: unknown): Output } {
  return {
    parse(value: unknown): Output {
      const result = schema['~standard'].validate(value) as
        | { readonly value: Output }
        | { readonly issues: readonly unknown[] }
      if ('issues' in result) {
        // The codec contract has no issue channel, so a rejected boundary value
        // must throw; the issues are kept in the message so the failing path is
        // readable rather than a bare "invalid".
        throw new TypeError(`expert-agents codec rejected a value: ${JSON.stringify(result.issues)}`)
      }
      return result.value
    },
  }
}

/** One strict codec over a schemastery schema. */
function codec<Output>(schema: {
  '~standard': { validate(value: unknown): unknown }
}): TypertCodec {
  return {
    mode: 'strict',
    typeSymbol: 'ExpertAgentsPayload',
    schema: parser<Output>(schema) as TypertSchema,
  }
}

/** The codec for a list of slugs. */
export const slugsCodec = codec<string[]>(enabledSchema)

/** The codec for a revision number. */
export const revisionCodec = codec<number>(z.natural())

/** The codec for the full state payload. */
export const stateCodec = codec<unknown>(stateSchema)

/**
 * The invocation descriptors, defined once for both halves.
 *
 * The Host registers them so the gateway can route calls; the client mounts them
 * so the `remote.expertAgents` namespace exists. Identical ids on both sides are
 * what pair them, so a typo here fails as an unroutable call rather than as
 * silently mismatched methods.
 */
export const INVOCATIONS = [
  {
    id: `${PACKAGE}#${SERVICE}/getState`,
    service: SERVICE,
    namespace: SERVICE,
    method: 'getState',
    invocation: { kind: 'direct' as const },
    parameters: [],
    result: stateCodec,
  },
  {
    id: `${PACKAGE}#${SERVICE}/setEnabled`,
    service: SERVICE,
    namespace: SERVICE,
    method: 'setEnabled',
    invocation: { kind: 'direct' as const },
    parameters: [
      { name: 'enabled', wire: 'enabled', source: 'json' as const, codec: slugsCodec },
      {
        name: 'expectedRevision',
        wire: 'expectedRevision',
        source: 'json' as const,
        codec: revisionCodec,
      },
    ],
    result: stateCodec,
  },
]
