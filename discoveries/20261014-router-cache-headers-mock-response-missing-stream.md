# router_cache_headers_test mock response is not stream-compatible

Status: logged

Discovered while establishing the baseline test state for issue #31 (reject unknown widget patch fields).

## What happens

`tests/router_cache_headers_test.mjs` builds a hand-rolled mock response object (`createMockResponse()`,
around line 20). Two of its three subtests fail because the router pipes a file read stream into that mock,
which does not implement the writable-stream surface `stream.pipe(...)` needs:

```
not ok 1 - module assets are served with no-store headers
not ok 3 - public page resources are served with no-store headers
# Error: Test "module assets are served with no-store headers" ... generated asynchronous activity after
#   the test ended. This activity created the error "TypeError: dest.on is not a function"
```

`not ok 2 - page shells are served with no-store headers` passes, because that path writes the body directly
instead of streaming it.

The failing assertions are therefore a harness gap, not a `Cache-Control` regression: the header values are
never reached because the stream handoff throws first.

## Reproduce

```
node --test tests/router_cache_headers_test.mjs
```

## Likely fix

Give the mock response the writable-stream methods the streaming router path uses (`on`, `once`, `emit`,
`write`, `end`), or build it on `node:stream.Writable` so `pipe(...)` works.

## Not fixed here

Out of scope for the #31 widget-patch validator change.
