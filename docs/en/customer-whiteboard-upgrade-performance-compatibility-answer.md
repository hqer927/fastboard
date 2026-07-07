# Customer Response Guide for Whiteboard Upgrade, Performance, Tracking, and Compatibility

This document responds to four groups of questions from a customer who plans to move from the Flat canary whiteboard stack to the official whiteboard stack:

- Whether Agora can provide CPU and memory usage broken down by component/module, or SDK performance hooks
- Whether Agora tracks basic tool usage such as pen, eraser, text, and shapes
- Whether backend APIs can enable or disable individual components independently
- Compatibility across old/new clients, SDK versions, devices, operating systems, room data, and phased rollout

References:

- Standard Fastboard documentation: [Fastboard Web Slide Integration Guide for Customers](./fastboard-web-slide-integration-customer-en.md)
- Flat legacy implementation: [netless-io/flat](https://github.com/netless-io/flat)
- Official projects: [white-web-sdk](https://www.npmjs.com/package/white-web-sdk), [netless-io/window-manager](https://github.com/netless-io/window-manager), [netless-io/fastboard](https://github.com/netless-io/fastboard), [@netless/app-slide](https://github.com/netless-io/netless-app/tree/slide-0.2/packages/app-slide), [@netless/app-docs-viewer](https://github.com/netless-io/netless-app/tree/master/packages/app-docs-viewer)

## 1. Version Background

The customer currently builds its whiteboard capability on top of the canary whiteboard stack used in the Flat project. According to `flat/pnpm-lock.yaml` and related `package.json` files, the legacy stack mainly includes:

| Module | Version/form used by Flat |
| --- | --- |
| `white-web-sdk` | `white-web-sdk-esm@2.16.48`, with additional dependency on `white-web-sdk@2.16.52` |
| `@netless/window-manager` | `1.0.0-canary.79` |
| `@netless/fastboard` | `1.0.0-canary.11` |
| `@netless/app-slide` | `0.3.0-canary.21` |
| `@netless/app-docs-viewer` | `1.0.0-canary.5` |

The official Fastboard version analyzed in this document is `@netless/fastboard@1.1.6`. The peer dependency requirements of `@netless/fastboard-core@1.1.6` include:

| Module | Official stack requirement |
| --- | --- |
| `white-web-sdk` | `>=2.16.54` |
| `@netless/window-manager` | `>=1.0.14` |
| `@netless/appliance-plugin` | `>=1.1.37` |

In the standard documentation, dynamic PPT continues to use `@netless/app-slide` and is registered as `Slide`; static PPT/PDF is recommended to use `@netless/app-presentation` and be installed as `DocsViewer`. If a customer's old Flat rooms have already persisted `Slide` or `DocsViewer` apps created by the old canary versions, those rooms need separate validation or compatibility routing.

## 2. Response

### 2.1 Can Agora provide CPU and memory data per component/module?

At this time, Agora cannot provide reliable CPU/memory data broken down by internal SDK component, and there is no public component-level CPU/memory performance hook.

The reason is that the whiteboard runs in the customer's browser. Browsers can usually provide stable data only at the tab, process, JavaScript heap, or task level. They cannot accurately attribute CPU and memory usage to individual SDK modules such as `white-web-sdk`, `window-manager`, `fastboard`, `app-slide`, `DocsViewer`, basic tools, or plugins. Results also vary across browsers, devices, operating systems, GPU capability, memory pressure, document resource size, and other business code running on the same page.

Agora internal logs focus more on network quality, connection stability, and issue diagnosis, such as connection, disconnection, reconnection, RTT, frame interval, and queue length. They are not product analytics reports for per-component resource consumption and are not suitable as the basis for the customer's capacity evaluation.

We recommend that the customer collect data in its own real integration environment:

1. Use the official SDK demo or the customer's own minimal integration page as a baseline.
2. Use browser capabilities such as Chrome Performance, Memory, Performance Monitor, Long Task API, `performance.memory`, and `requestAnimationFrame` FPS sampling to collect total metrics.
3. Use configuration switches for A/B comparison, instead of expecting the browser to output "component CPU" directly:
   - Basic whiteboard only
   - Basic whiteboard + `window-manager`
   - Basic whiteboard + dynamic PPT `Slide`
   - Basic whiteboard + static document `DocsViewer`
   - Basic whiteboard + `appliance-plugin`
4. Add business-side tracking for key actions, such as `createFastboard()`, `joinRoom()`, `insertDocs()`, opening/closing PPT, page navigation, zooming, and tool switching.

If the customer wants SDK-level performance hooks, that can be submitted as a product requirement. However, it should be clarified that even if lifecycle events or performance marks are added, they can only help the customer track key operation latency more conveniently. They still cannot produce exact browser-level CPU/memory attribution per SDK component.

### 2.2 Does Agora track basic tool usage?

Agora currently does not have aggregated statistics that can be directly shared with the customer for basic tools such as pen, eraser, text, and shapes.

The customer can build this tracking on the client side by subscribing to state change events. The selected basic tool is reflected in `memberState.currentApplianceName`; shape tools also use `memberState.shapeType`. Fastboard's toolbar reads these states through `app.memberState`, and `app.memberState` is backed by `room.callbacks.on("onRoomStateChanged")`.

Recommended tracking dimensions:

| Goal | Recommended method | Notes |
| --- | --- | --- |
| Tool selection count | Listen for changes in `memberState.currentApplianceName` | This counts "switched to a tool", not actual stroke count |
| Tool active duration | Record the time of each tool switch and calculate duration when leaving the tool | Browser close, disconnection, and refresh need compensation reporting |
| Shape type | Read `shapeType` when `currentApplianceName === "shape"` | Some basic shapes may also appear directly as `rectangle`, `ellipse`, `straight`, or `arrow` |
| appliance-plugin extended tools | Combine extension fields such as `strokeType`, `strokeOpacity`, `useLaserPen`, and `isLine` | These fields are plugin-extended states and should be verified against the integrated version |

Example:

```ts
let lastToolKey = "";

function normalizeTool(memberState: any): string {
  const name = memberState.currentApplianceName;

  if (name === "shape") {
    return `shape:${memberState.shapeType || "unknown"}`;
  }

  if (name === "pencil") {
    if (memberState.strokeType === "Stroke") return "pencil:stroke";
    if (memberState.strokeOpacity === 0.5) return "pencil:mark";
    return "pencil";
  }

  if (name === "eraser" && memberState.isLine === false) {
    return "pencilEraser";
  }

  return name || "unknown";
}

room.callbacks.on("onRoomStateChanged", ({ memberState }) => {
  if (!memberState) return;

  const toolKey = normalizeTool(memberState);
  if (toolKey && toolKey !== lastToolKey) {
    lastToolKey = toolKey;
    reportToolSelected(toolKey);
  }
});
```

If the customer needs to track "how many strokes were actually drawn", "how many objects were erased", or "how many text objects were inserted", listening only to `currentApplianceName` is not enough. That type of data needs additional tracking at the customer's UI operation layer or object change layer. The SDK currently does not provide a unified "operation completed" analytics event for all basic tools.

### 2.3 Do backend APIs support independently enabling/disabling individual components?

The whiteboard backend APIs do not support independently enabling or disabling components or tools. For example, there is no room-level backend configuration that directly disables the text tool or allows only the pencil tool.

What can be done is frontend integration-layer configuration:

1. Control the default UI through Fastboard UI config:

```ts
const uiConfig = {
  toolbar: {
    enable: true,
    items: ["selector", "pencil", "eraser"],
    apps: { enable: false },
  },
  redo_undo: { enable: true },
  zoom_control: { enable: true },
  page_control: { enable: true },
};
```

2. Hide the built-in toolbar completely, implement a custom toolbar, and expose only the allowed tools.
3. For window App features, control them by deciding whether to register Apps, whether to show the Apps button, and whether to allow calls to `insertDocs()` / `manager.addApp()`.
4. If centralized server-side configuration is required, the customer's business server can return feature flags, and the frontend can generate the UI config from those flags.

It is important to clarify to the customer that this is an integration-layer/product-layer switch, not a strong backend permission boundary. If a user can still execute custom JavaScript, or if the customer's code still calls the underlying APIs, hiding frontend buttons is not a security boundary. Backend-side strong control mainly covers overall permissions such as room writability, token, and user role, not individual whiteboard tool switches.

### 2.4 Can old and new clients/SDK versions coexist?

We do not recommend mixing the old Flat canary whiteboard stack and the official whiteboard stack in the same live room, especially when the room contains PPT, DocsViewer, window Apps, appliance-plugin, or custom plugins.

One concept should be clarified first: a whiteboard room is not "hosted" by a specific frontend SDK. Old and new clients both connect to the same whiteboard backend room and jointly read/write that room's state. If old and new SDKs interpret the same persisted app/window/tool state differently, the following issues may occur:

- A PPT that opens in the old client may fail to open in the new client or may not sync state correctly.
- An App created by the new client may be unknown to or unrenderable by the old client.
- The same tool state may have different meanings in old and new plugins.
- Old and new clients may show inconsistent UI behavior, increasing QA and reproduction cost.

We recommend routing by room or session:

| Room/session type | Recommended strategy |
| --- | --- |
| New room | Use the official whiteboard stack |
| Existing old Flat room without PPT/App/plugin | Can be validated first, then switched to the official stack |
| Existing old Flat room with dynamic PPT `Slide` | Separately validate legacy `attributes`, `scenePath`, and sync state |
| Existing old Flat room with old `DocsViewer` static courseware | Validate whether legacy `scenes[].ppt` data is correctly recognized by the new static document app |
| Existing old Flat room with appliance-plugin or custom plugins | Prefer staying on the old stack, or migrate only after dedicated compatibility testing |
| Same live session with both old and new clients | Not recommended, unless the business restricts the room from using PPT/App/plugin and completes validation |

For the basic capabilities of `white-web-sdk`, `@netless/window-manager`, and `@netless/fastboard`, upgrading to the official versions usually does not change basic whiteboard data in old rooms. However, courseware and plugins are risk areas:

- Dynamic PPT: Old Flat used `@netless/app-slide@0.3.0-canary.21`. The official integration still uses the `Slide` kind, but old room persisted `taskId`, `url`, `state`, and `scenePath` must be verified against the official version.
- Static PPT/PDF: Old Flat used `@netless/app-docs-viewer@1.0.0-canary.5`. The standard documentation recommends using `@netless/app-presentation` and installing it as `DocsViewer`. Existing `DocsViewer` apps in old rooms should be validated against their actual scenes data.
- appliance-plugin: It introduces extended tool states and a worker/OffscreenCanvas rendering path. Do not assume it is fully compatible with old Flat rooms without validation.

### 2.5 Does the SDK include automatic upgrade, downgrade, or phased rollout mechanisms?

No. The SDK does not orchestrate client version rollout, nor does it automatically upgrade or downgrade the customer's application based on the room.

Phased rollout, rollback, and old/new version routing need to be implemented by the customer's business layer. Recommended approach:

1. Store the whiteboard runtime version for each room on the business backend, for example:

```json
{
  "roomUUID": "xxx",
  "whiteboardRuntime": "flat-canary",
  "whiteboardRuntimeVersion": "flat-fastboard-canary-2024"
}
```

or:

```json
{
  "roomUUID": "xxx",
  "whiteboardRuntime": "official-fastboard",
  "whiteboardRuntimeVersion": "fastboard-1.1"
}
```

2. Before entering a room, the client requests room metadata and loads the corresponding whiteboard bundle based on the runtime.
3. Ensure all users in the same live session use the same whiteboard runtime.
4. Use the official version by default for new rooms, keep old rooms on the old version, and migrate gradually by data type.
5. Recommended rollout order:
   - Internal test rooms
   - A small number of new rooms
   - Existing rooms without courseware or plugins
   - Existing rooms with static courseware only
   - Existing rooms with dynamic PPT
   - Rooms with appliance-plugin or custom plugins
6. Keep rollback switches: when courseware opening failures, unknown App errors, or key errors increase, the backend can switch the room runtime back to the old stack.

## 3. Recommended Customer-Facing Reply

You can reply to the customer like this:

> Regarding per-component CPU/memory data: we currently do not have shareable CPU/memory data broken down by SDK internal component, and there is no public component-level CPU/memory performance hook. The Web whiteboard runs in the user's browser, where browsers usually provide resource data only at the tab, process, or JS heap level. It is difficult to reliably attribute that usage to a specific SDK module. We recommend collecting data on your target devices and real courseware using browser Performance/Memory tools and business-side tracking. We can provide recommended tracking points, such as joining a room, opening PPT, page navigation, zooming, and switching tools.

> Regarding basic tool usage tracking: Agora currently does not have aggregated statistics that can be directly shared for basic tools such as pen, eraser, text, and shapes. You can subscribe to room state change events on the client side and listen to `memberState.currentApplianceName`; for shapes, also read `memberState.shapeType`. This can track tool selection counts and active duration. If you need actual stroke counts or object change counts, additional tracking is needed in your own UI operation layer or object change layer.

> Regarding backend-level independent enable/disable of components: the whiteboard backend APIs currently do not support enabling or disabling a single tool or component. At the frontend integration layer, you can use Fastboard UI config, a custom toolbar, App registration, and Apps entry visibility to control feature exposure. If centralized configuration is needed, your business backend can return feature flags and the frontend can generate UI from them. Please note that this is not a strong backend permission boundary.

> Regarding old/new version compatibility and phased rollout: basic whiteboard room data can usually continue to be read by the official `white-web-sdk` / `window-manager` / `fastboard`, but dynamic PPT, static documents, appliance-plugin, or custom Apps created by the old Flat canary stack need separate validation. We do not recommend mixing old and new clients in the same live session. The SDK does not include built-in automatic upgrade/downgrade or phased rollout mechanisms. We recommend routing by room or session runtime: use the official version for new rooms, keep old rooms on the old version first, and migrate gradually after validation.

## 4. Recommended Performance Metrics for the Customer

| Metric | Collection method | Notes |
| --- | --- | --- |
| Initial whiteboard entry time | Wrap `createFastboard()` / `joinRoom()` with `performance.mark()` | Reflects SDK initialization, network connection, and room state recovery |
| Dynamic PPT open time | Wrap `insertDocs({ fileType: "pptx" })` until the document becomes operable | Strongly related to converted resource size, network, and browser performance |
| Static document open time | Wrap `insertDocs({ fileType: "pdf", scenes })` | Related to page count, image size, and lazy-loading strategy |
| Page navigation/animation response time | Wrap `dispatchDocsEvent()` and combine with visible UI state | Dynamic PPT and static documents should be measured separately |
| FPS | Sample with `requestAnimationFrame` | Used to observe drawing, zooming, dragging, and PPT animation |
| Long Task | Listen for `longtask` through `PerformanceObserver` | Used to observe main-thread jank |
| JS Heap | Chrome `performance.memory` or DevTools Memory | Available only in Chromium-based browsers; cannot be standardized across browsers |
| Tab memory | Browser task manager or automated collection | Good for version comparison, not for exact module attribution |
| Connection quality | SDK internal quality logs and customer-side network metrics | Used to distinguish network issues from rendering issues |

Example:

```ts
performance.mark("whiteboard:create:start");
const app = await createFastboard(config);
performance.mark("whiteboard:create:end");
performance.measure(
  "whiteboard:create",
  "whiteboard:create:start",
  "whiteboard:create:end"
);

performance.mark("docs:open:start");
const appId = await app.insertDocs(docsParams);
performance.mark("docs:open:end");
performance.measure("docs:open", "docs:open:start", "docs:open:end");
```

Long Task example:

```ts
const observer = new PerformanceObserver(list => {
  for (const entry of list.getEntries()) {
    reportLongTask({
      name: entry.name,
      startTime: entry.startTime,
      duration: entry.duration,
    });
  }
});

observer.observe({ entryTypes: ["longtask"] });
```

## 5. Tuning Directions That Can Be Shared with the Customer

Dynamic PPT `@netless/app-slide` supports render parameters during registration. For example, the standard documentation uses:

```ts
register({
  kind: "Slide",
  src: () => import("@netless/app-slide"),
  appOptions: {
    minFPS: 10,
    maxFPS: 20,
    resolution: 1,
    maxResolutionLevel: 2,
    skipActionWhenFrozen: true,
    antialias: false,
  },
});
```

appliance-plugin also provides performance/compatibility-oriented options:

- `useWorker: "auto"`: use worker when the browser supports OffscreenCanvas; otherwise fall back to the main thread
- `useSimple: true`: simple mode can be considered on mobile or low-performance devices
- `bufferSize`: adjust canvas cache according to device performance
- `useBackgroundThread: false`: avoid enabling it when background-thread capabilities are not required

These options help the customer tune behavior by device capability, but they are still not equivalent to per-component CPU/memory statistics.

## 6. Recommended Migration Strategy

### 6.1 Room Routing

Store the whiteboard runtime on the business backend:

| runtime | Purpose |
| --- | --- |
| `flat-canary` | Existing old Flat rooms, especially rooms with old PPT/App/plugin data |
| `official-fastboard` | New rooms and existing rooms whose compatibility has been verified |

Before the client enters a room:

1. Request `whiteboardRuntime` from the business backend.
2. Load the corresponding whiteboard bundle.
3. Join the whiteboard room.
4. Report runtime, SDK version, browser, OS, whether courseware was opened, and error information.

### 6.2 Room Precheck

Before migrating an old room, check whether it contains:

- `Slide-*` app
- `DocsViewer-*` app
- Custom App kind
- appliance-plugin related state
- A large number of whiteboard objects
- Very large static documents or dynamic PPT

If any of the above exists, the room should enter a dedicated validation queue and should not be switched directly to the official version.

### 6.3 Phased Rollout and Rollback

The rollout switch should live on the customer's business backend, not be hardcoded in the frontend package.

Minimum rollback capabilities:

- Switch back to the old runtime by roomUUID
- Disable the official version by user, tenant, or region
- Disable high-risk features such as dynamic PPT or appliance-plugin
- Switch the default runtime for newly created rooms back to the old version

## 7. Internal Evidence Summary

Key points from the code and documentation analysis:

- `FastboardApp.memberState` directly listens to `room.callbacks.on("onRoomStateChanged")` and reads `memberState`.
- `FastboardApp.setAppliance()` ultimately calls `manager.mainView.setMemberState({ currentApplianceName, shapeType })`.
- Fastboard's default toolbar tools include `clicker`, `selector`, `pencil`, `text`, `shapes`, `eraser`, and `clear`.
- Shapes include `rectangle`, `ellipse`, `straight`, `arrow`, `pentagram`, `rhombus`, `triangle`, and `speechBalloon`.
- `app-slide` also listens to `currentApplianceName` from `onRoomStateChanged` to control click-through behavior, which confirms that this event is an SDK-internal state source.
- `white-web-sdk` quality statistics focus on connection, disconnection, reconnection, RTT, frame interval, and queue length. They are not basic tool usage analytics.
- `app-docs-viewer` documentation lists the browser baseline as Chrome 88+, Firefox 85+, Safari 14+, and Edge 88+.
- appliance-plugin documentation states that mobile browser support depends on OffscreenCanvas support, and devices without OffscreenCanvas automatically fall back to main-thread mode.
- In the old Flat insertion logic, legacy dynamic PPT is created through `manager.addApp({ kind: "Slide", attributes: { taskId, url } })`; static documents are created through `BuiltinApps.DocsViewer`; new Projector PPTX uses `fastboardApp.insertDocs()`.

## 8. Final Recommendation

Keep the customer-facing conclusion conservative:

1. Do not promise that Agora can provide per-component CPU/memory data.
2. Do not promise that Agora has aggregated basic tool usage statistics.
3. Clearly tell the customer that they can use `onRoomStateChanged` / `memberState` to track tool selection and active duration themselves.
4. Clearly state that backend APIs do not support enabling/disabling individual whiteboard components.
5. Clearly state that the SDK does not include built-in phased rollout, upgrade, or downgrade orchestration.
6. For migration, recommend room-level runtime routing: use the official stack for new rooms, and validate old rooms in batches based on whether they contain PPT/App/plugin data.
