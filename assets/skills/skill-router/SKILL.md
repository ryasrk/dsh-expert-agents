---
name: skill-router
description: Search a local corpus of ~6,000 curated agent skills (testing, frontend, backend, cloud, data, writing, security, research, media) BEFORE doing any concrete task. Use at the START of any build/fix/test/deploy/configure/refactor/review request, unprompted - call skills_search with the task's goal, read the best-matching playbook with skills_read, and follow it. Default is ROUTE; skip only for pure chat.
---

# Skill router

You have access to a local corpus of **~6,000 specialized agent skills** that
is NOT in your catalog. It is vector-indexed and searchable in about a second.
A vetted playbook almost always beats improvising from general knowledge - so
search BEFORE planning, not after.

## When to route

Route by reading the conversation. A lookup is triggered by the SHAPE of the
message, not by the user naming a skill:

- The user describes something they want built, fixed, tested, deployed,
  configured, refactored, reviewed, or explained with intent to act.
- The user names a tool, framework, library, cloud, or database.
- The user asks "how do I / can we / please do".
- The conversation is mid-task and the next step is a concrete action.

Skip only when the turn is purely conversational: a greeting, thanks, a
clarification question, a status report - or you are already following a
skill loaded this turn.

Default is ROUTE. If unsure whether a turn counts, route anyway - a miss
costs one second. Silence after an actionable message is the failure mode
this skill exists to prevent.

## How to search

Write the query the way you would explain the task to a colleague - a goal,
not a keyword list. Semantic matching does the rest.

Call the `skills_search` tool with `query` (and `k` if you want more than
5 hits). Each result carries `path`, `score` (0-1), `name`, and a one-line
`description`.

If this host has no `skills_search` tool, run the bundled search CLI once:
feed it the JSON query `{"query":"<goal in plain words>","k":5}` on its
standard input (it reads stdin and writes JSON to stdout; adapt the stdin/pipe
invocation to whatever shell this host provides — on Linux/macOS that is bash,
on Windows it is PowerShell):
```
node "/home/ryasr/.dsh/profiles/web/node_modules/dsh-awesome-skills/lib/query.js"
```
The CLI answers with a JSON object whose `results` are the ranked hits.

### Reading the scores

Calibrated on labeled task queries against this corpus: strong-band top hits
were relevant nearly every time; mid-band hits are plausible but need a skim;
weak-band hits rarely help. Trust the bands:

- **0.7+** strong match - read it.
- **0.4-0.7** plausible - read the top 2-3 descriptions, not
  just the first line; the best playbook for the task is often at rank 2-3.
- **< 0.4** weak - likely no good playbook for this exact task.

### When one query is not enough

- **Broad request** ("build me a dashboard") → run 2-3 queries for its
  distinct facets (e.g. "frontend dashboard layout", "charts data
  visualization", "deploy static site") and take the best hit from each.
- **First results all score < 0.4** → rephrase ONCE with different
  wording ("auth" → "login session cookie"). A second miss means the corpus
  likely has nothing; move on without guilt.
- **Multiple hits with the same trailing name** from different sources
  (e.g. several `tdd` skills, or duplicates across
  `a5c-ai/babysitter/<domain>/` specializations) → they are alternative
  takes. The full `path` distinguishes them. Prefer the one whose
  description fits the user's stack; when they look equivalent, prefer the
  higher score and read just one.

### Decision points, don't drift

- Task is one clear domain and a hit scores 0.7+ → read exactly one
  skill and follow it.
- Task genuinely spans domains (e.g. "add OAuth to my FastAPI app") → read at
  most two skills (one per domain), name which is primary, and follow the
  primary for the overall shape.

## How to read a hit

Call the `skills_read` tool with the hit's `path` (**never** the display
`name` - paths are unique) to load its SKILL.md. If this host has no
`skills_read` tool, read the file directly with the host's file-read
capability at `/home/ryasr/.dsh/awesome-skills/skills/<path>/SKILL.md`.

A skill's directory holds its complete playbook: reference files, templates,
examples, and scripts live beside the SKILL.md. When the SKILL.md says "read
tests.md" or points at `references/` or `scripts/`, load those with
`skills_read` (path + `file`) too - they are part of the skill, not optional
decoration. If `skills_read` is unavailable, list the directory
`/home/ryasr/.dsh/awesome-skills/skills/<path>/` with the host's file browser to see its contents.

## Rules

- Read before acting: search → read the match → then plan. Quoting a skill's
  title from memory is not following it.
- Never paste a whole skill file into the chat - read it, then act on it.
- Follow the playbook, adapt the details. If a step genuinely does not fit
  the user's context, say so and adapt rather than silently skipping.
- If nothing relevant comes back after one rephrase, continue normally. A
  miss costs one second and is not a failure.
