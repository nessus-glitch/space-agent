import assert from "node:assert/strict";
import module from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { parseSimpleYaml, serializeSimpleYaml } from "../app/L0/_all/mod/_core/framework/js/yaml-lite.js";

const APP_MODULE_ROOT = path.resolve("app/L0/_all");
const SPACE_ID = "space-1";
const WIDGET_ID = "demo";
const MANIFEST_PATH = `~/spaces/${SPACE_ID}/space.yaml`;
const WIDGET_PATH = `~/spaces/${SPACE_ID}/widgets/${WIDGET_ID}.yaml`;
const WIDGET_RENDERER_SOURCE = [
  "(parent) => {",
  "  parent.style.background = '#6f8f54';",
  "  parent.textContent = 'hello';",
  "}"
].join("\n");

// storage.js imports sibling modules through absolute `/mod/...` browser specifiers,
// so resolve those to the repo app-module root before importing it under Node.
const APP_MODULE_RESOLVE_HOOKS_SOURCE = `
import path from "node:path";
import { pathToFileURL } from "node:url";

let appModuleRoot = "";

export function initialize(data) {
  appModuleRoot = data.appModuleRoot;
}

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("/mod/")) {
    return { shortCircuit: true, url: pathToFileURL(path.join(appModuleRoot, specifier)).href };
  }

  return nextResolve(specifier, context);
}
`;

module.register(`data:text/javascript,${encodeURIComponent(APP_MODULE_RESOLVE_HOOKS_SOURCE)}`, {
  data: {
    appModuleRoot: APP_MODULE_ROOT
  }
});

function createWidgetFileRuntime(rendererSource = WIDGET_RENDERER_SOURCE) {
  const files = new Map([
    [
      MANIFEST_PATH,
      serializeSimpleYaml({
        created_at: "2026-01-01T00:00:00.000Z",
        id: SPACE_ID,
        layout_order: [WIDGET_ID],
        schema: "spaces/v2",
        updated_at: "2026-01-01T00:00:00.000Z"
      })
    ],
    [
      WIDGET_PATH,
      serializeSimpleYaml({
        cols: 6,
        id: WIDGET_ID,
        name: "Demo",
        renderer: rendererSource,
        rows: 3,
        schema: "space-widget/v1"
      })
    ]
  ]);
  const writtenPaths = [];

  globalThis.space = {
    api: {
      async fileList(dirPath) {
        return {
          paths: [...files.keys()].filter((filePath) => filePath.startsWith(String(dirPath || "")))
        };
      },
      async fileRead(request) {
        if (Array.isArray(request?.files)) {
          return {
            files: request.files.map((filePath) => ({
              content: files.get(filePath) ?? "",
              path: filePath
            }))
          };
        }

        return {
          content: files.get(request) ?? "",
          path: request
        };
      },
      async fileWrite(request) {
        (Array.isArray(request?.files) ? request.files : [request]).forEach((file) => {
          writtenPaths.push(file.path);
          files.set(file.path, file.content);
        });

        return { ok: true };
      }
    },
    utils: {
      yaml: {
        parse: parseSimpleYaml,
        stringify: serializeSimpleYaml
      }
    }
  };

  return {
    readRendererSource() {
      return parseSimpleYaml(files.get(WIDGET_PATH)).renderer;
    },
    writtenPaths
  };
}

async function loadSpacesStorageModule() {
  return import(pathToFileURL(path.join(APP_MODULE_ROOT, "mod/_core/spaces/storage.js")).href);
}

test("patchWidget rejects an unknown edit field before writing anything", async () => {
  const runtime = createWidgetFileRuntime();
  const storage = await loadSpacesStorageModule();

  await assert.rejects(
    storage.patchWidget({
      edits: [
        {
          find: "parent.style.background = '#6f8f54';",
          replacement: "parent.style.background = '#5f7f3f';"
        }
      ],
      spaceId: SPACE_ID,
      widgetId: WIDGET_ID
    }),
    /Widget patch edits do not support `replacement`.*No files were written\./u
  );

  assert.equal(runtime.readRendererSource(), WIDGET_RENDERER_SOURCE);
  assert.deepEqual(runtime.writtenPaths, []);
});

test("patchWidget rejects an unknown line-edit field before writing anything", async () => {
  const runtime = createWidgetFileRuntime();
  const storage = await loadSpacesStorageModule();

  await assert.rejects(
    storage.patchWidget({
      edits: [
        {
          from: 1,
          newText: "  parent.style.background = '#5f7f3f';",
          to: 1
        }
      ],
      spaceId: SPACE_ID,
      widgetId: WIDGET_ID
    }),
    /Widget patch edits do not support `newText`/u
  );

  assert.equal(runtime.readRendererSource(), WIDGET_RENDERER_SOURCE);
  assert.deepEqual(runtime.writtenPaths, []);
});

test("patchWidget leaves the renderer untouched when one edit in a batch is unknown", async () => {
  const runtime = createWidgetFileRuntime();
  const storage = await loadSpacesStorageModule();

  await assert.rejects(
    storage.patchWidget({
      edits: [
        {
          find: "parent.textContent = 'hello';",
          replace: "parent.textContent = 'patched';"
        },
        {
          find: "parent.style.background = '#6f8f54';",
          replacement: "parent.style.background = '#5f7f3f';"
        }
      ],
      spaceId: SPACE_ID,
      widgetId: WIDGET_ID
    }),
    /Widget patch edits do not support `replacement`/u
  );

  assert.equal(runtime.readRendererSource(), WIDGET_RENDERER_SOURCE);
  assert.deepEqual(runtime.writtenPaths, []);
});

test("patchWidget still deletes a snippet when `replace` is intentionally omitted", async () => {
  const runtime = createWidgetFileRuntime();
  const storage = await loadSpacesStorageModule();

  await storage.patchWidget({
    edits: [
      {
        find: "  parent.style.background = '#6f8f54';\n"
      }
    ],
    spaceId: SPACE_ID,
    widgetId: WIDGET_ID
  });

  assert.equal(
    runtime.readRendererSource(),
    [
      "(parent) => {",
      "  parent.textContent = 'hello';",
      "}"
    ].join("\n")
  );
  assert.deepEqual(runtime.writtenPaths, [MANIFEST_PATH, WIDGET_PATH]);
});

test("patchWidget still deletes a line range when `content` is intentionally omitted", async () => {
  const runtime = createWidgetFileRuntime();
  const storage = await loadSpacesStorageModule();

  await storage.patchWidget({
    edits: [
      {
        from: 1,
        to: 1
      }
    ],
    spaceId: SPACE_ID,
    widgetId: WIDGET_ID
  });

  assert.equal(
    runtime.readRendererSource(),
    [
      "(parent) => {",
      "  parent.textContent = 'hello';",
      "}"
    ].join("\n")
  );
  assert.deepEqual(runtime.writtenPaths, [MANIFEST_PATH, WIDGET_PATH]);
});

test("patchWidget keeps supported snippet and line edit aliases working", async () => {
  const snippetRuntime = createWidgetFileRuntime();
  const storage = await loadSpacesStorageModule();

  await storage.patchWidget({
    edits: [
      {
        search: "parent.style.background = '#6f8f54';",
        text: "parent.style.background = '#5f7f3f';"
      }
    ],
    spaceId: SPACE_ID,
    widgetId: WIDGET_ID
  });

  assert.equal(
    snippetRuntime.readRendererSource(),
    [
      "(parent) => {",
      "  parent.style.background = '#5f7f3f';",
      "  parent.textContent = 'hello';",
      "}"
    ].join("\n")
  );

  const lineRuntime = createWidgetFileRuntime();

  await storage.patchWidget({
    edits: [
      {
        range: [2, 2],
        value: "  parent.textContent = 'patched';"
      }
    ],
    spaceId: SPACE_ID,
    widgetId: WIDGET_ID
  });

  assert.equal(
    lineRuntime.readRendererSource(),
    [
      "(parent) => {",
      "  parent.style.background = '#6f8f54';",
      "  parent.textContent = 'patched';",
      "}"
    ].join("\n")
  );

  const startLineRuntime = createWidgetFileRuntime();

  await storage.patchWidget({
    edits: [
      {
        content: "  parent.textContent = 'aliased';",
        endLine: 2,
        startLine: 2
      }
    ],
    spaceId: SPACE_ID,
    widgetId: WIDGET_ID
  });

  assert.equal(
    startLineRuntime.readRendererSource(),
    [
      "(parent) => {",
      "  parent.style.background = '#6f8f54';",
      "  parent.textContent = 'aliased';",
      "}"
    ].join("\n")
  );

  const singleLineRuntime = createWidgetFileRuntime();

  await storage.patchWidget({
    edits: [
      {
        content: "  parent.style.background = '#405f2f';",
        line: 1
      }
    ],
    spaceId: SPACE_ID,
    widgetId: WIDGET_ID
  });

  assert.equal(
    singleLineRuntime.readRendererSource(),
    [
      "(parent) => {",
      "  parent.style.background = '#405f2f';",
      "  parent.textContent = 'hello';",
      "}"
    ].join("\n")
  );

  const insertRuntime = createWidgetFileRuntime();

  await storage.patchWidget({
    edits: [
      {
        content: "  parent.dataset.ready = 'yes';",
        from: 1
      }
    ],
    spaceId: SPACE_ID,
    widgetId: WIDGET_ID
  });

  assert.equal(
    insertRuntime.readRendererSource(),
    [
      "(parent) => {",
      "  parent.dataset.ready = 'yes';",
      "  parent.style.background = '#6f8f54';",
      "  parent.textContent = 'hello';",
      "}"
    ].join("\n")
  );
});
