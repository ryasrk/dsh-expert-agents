# Does a harness change measurably move outcomes? A measurement on this checkout

The premise for building a cognitive kernel is that effective agent capability is
not the base model's capability. On the standard decomposition:

```
A = f(M, H, E)
```

agent capability `A` is a function of the model `M`, the harness `H`, and the
environment `E`. If that is true, then holding `M` and `E` fixed and changing only
`H` must produce a measurable difference in outcome. If it does not, the premise
is false and a harness-level intervention cannot help.

This document records a measurement of that claim, run against this checkout.

## What was and was not attempted

**Not attempted:** reproducing any published benchmark figure. The numbers
circulating for harness effects are large — the ARC-AGI-3 comparison in the
source material claims 62.7% against 99.9% for the same model under two harnesses
— and several of the citations attached to those numbers do not survive checking.
A specific figure quoted from a discussion thread is not a measurement, and
adopting one as a target would be unsound.

**Attempted:** answering the narrower question that actually decides the design.
On this codebase, with a model held byte-identical, can a harness-level change be
shown to alter the outcome? That is testable here, deterministically, with no real
model route.

## Method

The measurement drives the real machinery:

- the real `AgentLoop`, through `dsh-agent-loop-testkit`
- the real tool registry and the real filesystem
- the real DeepSeek adapter, over HTTP, against `dsh-llm-mock-server`

The model is a scripted mock. Its responses are identical across arms, which is
what makes the comparison valid: any difference in outcome cannot be attributed
to the model, because the model contributed the same bytes.

The scripted sequence is a tool call followed by a completion claim — the shape
that matters, because it is where a model asserts something the harness can
independently check.

Two credential notes. No real API key is involved: the mock server accepts any
value, and `DEEPSEEK_API_KEY` is stubbed with `stub-key` to satisfy per-request
resolution. And a subagent needs no credential of its own; the key gates LLM
inference only.

## Result

```
model claimed done = true
artifact present   = false
trusting harness accepts = true
checking harness accepts = false
```

This is the whole finding, and it is worth reading carefully.

The model claimed success. The artifact did not exist. Both are facts about the
run, and the second is the one that decides whether the work was actually done.

Two harnesses look at the same situation and reach opposite verdicts. A harness
that accepts the model's word concludes the task is complete. A harness that reads
the filesystem concludes it is not. The model is byte-identical in both cases, so
the divergence is attributable to the harness alone.

This reproduces the mechanism the premise depends on, in its smallest honest
form. It says nothing about how large the effect is on a real benchmark. It says
that the effect is real, on this codebase, and that it is caused by the harness.

## A second, independent lever

A harness also changes what the model conditions on. Appending one instruction —
`Before claiming completion, verify the artifact exists.` — to an otherwise
identical request changes the request bytes while the model, adapter, and tool set
stay fixed. This is directly observable in the mock's request record, and it is
the mechanism behind every prompt-level harness effect.

That the request differs is measured. That the model then behaves differently is
not, and cannot be, without a real model. This is the boundary of what can be
established here.

## What this licenses, and what it does not

**Licensed.** A harness-level intervention can change outcomes with the model held
constant, so building one is not futile. Specifically, verification is a real
lever: the difference between trusting a claim and checking it is the difference
between a wrong verdict and a right one, and no model change is required to
capture it.

**Not licensed.** Any claim about effect size. This measurement does not support
"a better harness makes an agent N% more capable." It supports the much weaker and
still useful claim that the mechanism exists and is measurable.

**The honest limitation.** The mock model is scripted. It does not decide to claim
success; it is told to. A real model might, in the checking harness, notice the
failure and retry — which is the larger effect and remains unmeasured. What is
established is that the harness changes what is *observable*, not that a real model
would exploit it.

## Why this matters for what gets built

The measurement points at verification, and the cognitive audit independently
points at the same place from the other direction: DSH has no self-verification,
no reflection, and no memory, and `tool-ralph` — its longest-running autonomous
loop — states outright that its rounds "are not independently verified."

So the two investigations agree. An autonomous loop on this harness can iterate
for its full round allowance producing confidently wrong work, and the harness has
no mechanism that distinguishes that from success. The gap is not intelligence. It
is that nothing checks.

That is the gap worth patching, and it is now backed by a measurement rather than
an assumption.
