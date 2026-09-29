import { c as PACKAGE, d as EXPERTS, l as SERVICE, r as catalogPayload, s as INVOCATIONS, u as SETTINGS_NAMESPACE } from "./src-C79e1PKk.js";
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
//#region src/remote.ts
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
/**
* The stored `enabled` array for this plugin's entry.
*
* 0.2.0 removed `settings.register`: namespaces are gone, and a form is the
* projection of a profile entry's own volatile Config fields. `SETTINGS_NAMESPACE`
* is therefore the ENTRY ID this Remote row owns, and reads/writes go through
* `describe`/`mutate` on that entry. Reading through `describe` also keeps the
* single-writer property the old scope handle had: the value is whatever the
* profile composition currently resolves to, never a snapshot captured at mount.
*
* @param settings - the Host settings service.
* @returns the stored slugs, or `undefined` when the entry is absent or unreadable.
*/
function storedSlugs(settings) {
	const enabled = (settings.describe({ redactSecrets: true }).find((candidate) => candidate.ns === SETTINGS_NAMESPACE)?.value)?.enabled;
	return Array.isArray(enabled) ? enabled.filter((slug) => typeof slug === "string") : void 0;
}
/**
* The Typert contribution.
*
* The invocation descriptors come from the shared contract module rather than
* being written here, so the ids the gateway routes and the ids the client
* mounts cannot drift apart.
*/
const TYPERT = {
	package: PACKAGE,
	face: "host",
	schemas: [],
	model: {
		services: [],
		events: [],
		objects: []
	},
	invocations: INVOCATIONS
};
/** The default set: every expert enabled, so a fresh install is usable. */
const DEFAULT_ENABLED = EXPERTS.map((expert) => expert.slug);
var ExpertAgentsRemote = class extends TypertRemoteService {
	static inject = ["settings", "typert"];
	constructor(ctx) {
		super(ctx, SERVICE);
		ctx.typert.register(TYPERT);
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
		const known = new Set(DEFAULT_ENABLED);
		const stored = storedSlugs(this.ctx.settings);
		return {
			enabled: stored === void 0 ? DEFAULT_ENABLED : stored.filter((slug) => known.has(slug)),
			revision: this.revision(),
			experts: await catalogPayload()
		};
	}
	/**
	* Replace the enabled set, rejecting the write if the stored revision moved.
	*
	* Enabling nothing is allowed and is the way to silence the roster without
	* uninstalling it. Unknown slugs are dropped rather than stored, so a stale
	* client cannot introduce one.
	*/
	async setEnabled(enabled, expectedRevision) {
		const known = new Set(DEFAULT_ENABLED);
		const clean = [...new Set(enabled.filter((slug) => known.has(slug)))];
		await this.ctx.settings.mutate(SETTINGS_NAMESPACE, [{
			op: "set",
			path: ["enabled"],
			value: clean
		}], expectedRevision);
		return await this.getState();
	}
	/** The current revision of this plugin's settings entry. */
	revision() {
		const descriptor = this.ctx.settings.describe({ redactSecrets: true }).find((candidate) => candidate.ns === SETTINGS_NAMESPACE);
		if (descriptor === void 0) return 0;
		return descriptor.revision;
	}
};
//#endregion
export { ExpertAgentsRemote as default };
