# Several frontend-module tests cannot resolve `/mod/...` specifiers under Node

Status: logged

Discovered while adding `tests/spaces_widget_patch_test.mjs` for issue #31 (reject unknown widget patch
fields).

## What happens

App modules under `app/L0/_all/mod/` import siblings through absolute browser specifiers such as
`/mod/_core/framework/js/token-count.js`. Node resolves those against the filesystem root, so any test that
imports a module whose transitive imports use that form fails before a single assertion runs:

```
tests/prompt_items_test.mjs
  Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/mod/_core/framework/js/token-count.js'
    imported from .../app/L0/_all/mod/_core/agent_prompt/prompt-items.js

tests/promptinclude_test.mjs
  Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/mod/_core/agent_prompt/prompt-items.js'

tests/prompt_budget_trim_test.mjs
  Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/mod/_core/framework/js/token-count.js'

tests/onscreen_agent_prompt_shape_test.mjs
  Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/mod/_core/agent-chat/visual-data.js'
    imported from .../app/L0/_all/mod/_core/onscreen_agent/attachments.js
```

These four files fail entirely (`# pass 0`), so the behavior they are meant to cover is currently unverified.

## Reproduce

```
node --test tests/prompt_items_test.mjs
node --test tests/promptinclude_test.mjs
node --test tests/prompt_budget_trim_test.mjs
node --test tests/onscreen_agent_prompt_shape_test.mjs
```

## Likely fix

Register an ESM resolve hook that maps `/mod/...` onto `app/L0/_all/mod/...`, the way
`tests/spaces_widget_patch_test.mjs` now does locally. Lifting that hook into a shared
`tests/` helper would fix all four files at once and let future frontend tests import real app
modules instead of only leaf helpers.

## Not fixed here

Out of scope for the #31 widget-patch validator change.
