# set_command_test runtime-param cases read a hardcoded absolute project root

Status: logged

Discovered while establishing the baseline test state for issue #31 (reject unknown widget patch fields).

## What happens

`tests/set_command_test.mjs` passes the literal absolute path `/workspace/agent-one` as `projectRoot` to
`loadParamSpecs(...)` and `createRuntimeParams(...)` (lines 34, 48, 59, 77-78, 99-107). Those two helpers in
`server/lib/utils/runtime_params.js` read `<projectRoot>/commands/params.yaml` from disk, so the tests only
pass on a checkout that happens to live at `/workspace/agent-one`.

In this worktree two subtests fail:

```
not ok 3 - runtime params schema exposes GIT_BACKEND with auto default
not ok 4 - runtime params and env resolve requested git backend
  error: "ENOENT: no such file or directory, open '/workspace/agent-one/commands/params.yaml'"
```

Subtests 1, 2 and 5 pass because they do not touch the filesystem.

## Reproduce

```
node --test tests/set_command_test.mjs
```

## Likely fix

Resolve the project root from the test file location (the pattern other tests use, e.g.
`path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")`) instead of hardcoding
`/workspace/agent-one`.

## Not fixed here

Out of scope for the #31 widget-patch validator change.
