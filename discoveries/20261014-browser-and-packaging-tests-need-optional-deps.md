# Browser-harness and desktop-packaging tests require unmet packaging dependencies

Status: logged

Discovered while establishing the baseline test state for issue #31 (reject unknown widget patch fields).

## What happens

Four test files fail in a checkout where only the root `package.json` dependencies are installed:

```
tests/browser_address_bar_test.mjs
tests/browser_content_format_test.mjs
tests/browser_desktop_harness_test.mjs
  error: 'Packaging dependencies are not installed. Missing package: electron.
           Run "npm install --prefix packaging" before using desktop or packaging commands.'

tests/desktop_packaging_test.mjs
  Error: Cannot find module 'semver'
```

This is an environment prerequisite rather than a product defect, but nothing in `tests/AGENTS.md` records
which files need `npm install --prefix packaging` first, so a plain `node --test tests/` run looks like six
real failures.

## Reproduce

```
node --test tests/browser_address_bar_test.mjs
node --test tests/desktop_packaging_test.mjs
```

The browser harness tests also need a display (or Xvfb) even once Electron is installed.

## Likely fix

Either document the prerequisite in `tests/AGENTS.md` under Verification, or have these harnesses skip with a
clear message when the packaging dependency tree is absent, so the default suite stays green on a fresh
clone.

## Not fixed here

Out of scope for the #31 widget-patch validator change.
