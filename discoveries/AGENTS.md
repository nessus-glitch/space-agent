# AGENTS

## Purpose

`discoveries/` holds one file per unrelated defect or gap found while working on something else, so the finding survives the session without widening the current change.

## Ownership

This scope owns the discovery notes themselves. It owns no code and no fix; a discovery is a durable record, not a task tracker.

## Local Contracts

- one file per finding, named `<YYYYMMDD>-<slug>.md`
- every file opens with a `# <title>` line followed by `Status: logged`
- a file must state what happens, how to reproduce it, the likely fix, and why it was not fixed in the change that found it
- do not fix a logged discovery as part of an unrelated change; land it as its own change and delete the file when it is resolved

## Work Guidance

- record the observed output verbatim, not a paraphrase, so the finding stays verifiable later
- keep findings separate even when they share a root cause, unless one fix provably closes all of them

## Verification

None. These are notes, not code.
