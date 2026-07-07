# 客户关于白板升级、性能、埋点和兼容性的答复建议

本文用于回应客户从 Flat canary 白板栈切换到正式白板栈时提出的四类问题：

- 是否能提供按组件/模块拆分的 CPU 和内存数据，或 SDK 性能钩子
- 是否能统计笔、橡皮擦、文字、形状等基础工具使用情况
- 后端 API 是否能按组件独立启用/禁用
- 新旧客户端/SDK 在设备、系统、房间数据和灰度发布上的兼容性

参考范围：

- 标准 Fastboard 文档：[Fastboard Web 文档集成指南（客户版）](./fastboard-web-slide-integration-customer.md)
- Flat 旧实现：[netless-io/flat](https://github.com/netless-io/flat)
- 正式版本项目：[white-web-sdk](https://www.npmjs.com/package/white-web-sdk)、[netless-io/window-manager](https://github.com/netless-io/window-manager)、[netless-io/fastboard](https://github.com/netless-io/fastboard)、[@netless/app-slide](https://github.com/netless-io/netless-app/tree/slide-0.2/packages/app-slide)、[@netless/app-docs-viewer](https://github.com/netless-io/netless-app/tree/master/packages/app-docs-viewer)

## 1. 版本背景

客户当前基于 Flat 项目里的 canary 白板栈实现白板能力。根据 `flat/pnpm-lock.yaml` 和相关 `package.json`，旧栈主要包含：

| 模块 | Flat 中使用的版本/形态 |
| --- | --- |
| `white-web-sdk` | `white-web-sdk-esm@2.16.48`，另有 `white-web-sdk@2.16.52` 依赖 |
| `@netless/window-manager` | `1.0.0-canary.79` |
| `@netless/fastboard` | `1.0.0-canary.11` |
| `@netless/app-slide` | `0.3.0-canary.21` |
| `@netless/app-docs-viewer` | `1.0.0-canary.5` |

本文分析的正式 Fastboard 版本为 `@netless/fastboard@1.1.6`，`@netless/fastboard-core@1.1.6` 的 peer dependency 要求包括：

| 模块 | 正式栈约束 |
| --- | --- |
| `white-web-sdk` | `>=2.16.54` |
| `@netless/window-manager` | `>=1.0.14` |
| `@netless/appliance-plugin` | `>=1.1.37` |

标准文档中，动态 PPT 继续使用 `@netless/app-slide` 并注册为 `Slide`；静态 PPT/PDF 建议使用 `@netless/app-presentation` 并以 `DocsViewer` 方式安装。客户旧 Flat 房间如果已经持久化了旧 canary 版本创建的 `Slide` 或 `DocsViewer` app，需要单独验证或做兼容路由。

## 2. 答复

### 2.1 是否能提供每个组件/模块的 CPU 和内存数据？

目前不能提供可靠的“按 SDK 内部组件拆分”的 CPU/内存数据，也没有公开的按组件 CPU/内存性能钩子。

原因是白板在客户浏览器中运行，浏览器通常只能稳定提供 tab、进程、JS heap 或任务级别的数据，不能把 CPU 和内存精确归因到 `white-web-sdk`、`window-manager`、`fastboard`、`app-slide`、`DocsViewer`、基础教具或插件内部的某一个模块。不同浏览器、设备、系统、GPU、内存压力、文档资源大小和页面上其他业务代码都会影响结果。

Agora 内部日志更偏向网络质量、连接稳定性和问题定位，例如连接、断线、重连、RTT、帧间隔、队列长度等，不是产品分析意义上的按组件资源占用报表，也不适合作为客户侧容量评估依据。

建议客户按自己的真实集成场景采集：

1. 使用正式 SDK demo 或客户自己的最小集成页面做基线。
2. 使用 Chrome Performance、Memory、Performance Monitor、Long Task API、`performance.memory`、`requestAnimationFrame` FPS 采样等浏览器能力采集总量指标。
3. 用配置开关做 A/B 对比，而不是期望浏览器直接输出“组件 CPU”：
   - 仅基础白板
   - 基础白板 + `window-manager`
   - 基础白板 + 动态 PPT `Slide`
   - 基础白板 + 静态文档 `DocsViewer`
   - 基础白板 + `appliance-plugin`
4. 在业务侧对关键动作打点，例如 `createFastboard()`、`joinRoom()`、`insertDocs()`、打开/关闭 PPT、翻页、缩放、切换工具等。

如果客户希望有 SDK 级性能钩子，可以作为产品需求反馈，但需要说明：即使增加生命周期事件或性能 mark，也只能帮助客户更方便地打点关键操作耗时，不能从浏览器层面精确产出每个 SDK 组件的 CPU/内存归因。

### 2.2 Agora 是否跟踪基础工具使用情况？

当前没有可直接分享给客户的按基础工具拆分的聚合统计，例如笔、橡皮擦、文字、形状分别被使用了多少次。

客户可以自行在客户端订阅状态变化事件来做统计。基础工具选择状态会体现在 `memberState.currentApplianceName`，形状工具还会带 `memberState.shapeType`。Fastboard 的工具栏内部也是通过 `app.memberState` 读取这些状态；`app.memberState` 底层来自 `room.callbacks.on("onRoomStateChanged")`。

推荐统计两类数据：

| 统计目标 | 推荐方式 | 注意事项 |
| --- | --- | --- |
| 工具选择次数 | 监听 `memberState.currentApplianceName` 变化 | 只统计“切换到某工具”，不是实际绘制笔画数 |
| 工具使用时长 | 记录工具切换时间，离开时计算停留时长 | 浏览器关闭、掉线、刷新时需要补偿上报 |
| 形状类型 | `currentApplianceName === "shape"` 时读取 `shapeType` | 部分基础形状也可能直接表现为 `rectangle`、`ellipse`、`straight`、`arrow` |
| appliance-plugin 扩展工具 | 结合扩展字段，如 `strokeType`、`strokeOpacity`、`useLaserPen`、`isLine` | 字段属于插件扩展状态，建议按已接入版本验证 |

示例：

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

如果客户需要统计“实际画了多少笔、擦除了多少对象、插入了多少文本”，仅监听 `currentApplianceName` 不够。那类数据需要在客户自己的 UI 操作层或对象变更层补充埋点，SDK 当前没有对所有基础教具提供统一的“操作完成”分析事件。

### 2.3 后端 API 是否支持独立启用/禁用单个组件？

白板后端 API 不支持按组件或按工具独立启用/禁用，例如不能在房间配置层直接关闭“文字工具”或只开启“铅笔”。

可以做的是前端集成层配置：

1. 通过 Fastboard UI config 控制默认 UI：

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

2. 完全隐藏内置 toolbar，客户自己实现 toolbar，然后只暴露允许的工具。
3. 对窗口 App 类功能，通过是否注册 App、是否展示 Apps 按钮、是否允许调用 `insertDocs()` / `manager.addApp()` 来控制。
4. 如果要统一由服务端配置，可以由客户业务服务返回 feature flag，前端读取后生成上述 UI config。

需要明确告诉客户：这属于“集成层/产品层开关”，不是白板后端强权限。若用户仍能执行自定义 JS 或客户代码仍调用底层 API，前端隐藏按钮本身不能作为安全边界。后端能做的强控制主要是房间可写权限、token、用户角色等整体权限，而不是单个白板工具开关。

### 2.4 新旧客户端/SDK 是否可以共存？

不建议在同一个实时房间内混用旧 Flat canary 白板栈和正式白板栈，尤其是房间里存在 PPT、DocsViewer、窗口 App、appliance-plugin 或自定义插件时。

需要先澄清一个概念：白板房间不是由某一个前端 SDK “托管”的。新旧客户端都是连接同一个白板后端房间，并共同读写这个房间里的状态。如果新旧 SDK 对同一份持久化 app/window/教具状态理解不同，就可能出现：

- 旧客户端能打开的 PPT，新客户端打开失败或状态不同步
- 新客户端创建的 App，旧客户端不认识或无法渲染
- 同一工具状态在旧/新插件里含义不同
- 新旧客户端 UI 行为不一致，QA 复现成本增加

建议按“房间级别”或“会话级别”做版本路由：

| 房间/会话类型 | 建议策略 |
| --- | --- |
| 新建房间 | 使用正式白板栈 |
| 存量旧 Flat 房间，没有 PPT/App/插件 | 可优先验证后切到正式栈 |
| 存量旧 Flat 房间，有动态 PPT `Slide` | 需要单独验证旧 `attributes`、`scenePath`、同步状态 |
| 存量旧 Flat 房间，有旧 `DocsViewer` 静态课件 | 需要验证旧 `scenes[].ppt` 数据是否被新静态文档 app 正确识别 |
| 存量旧 Flat 房间，启用了 appliance-plugin 或自定义插件 | 建议继续走旧栈，或做专项兼容测试后再迁移 |
| 同一个 live session 中同时有旧客户端和新客户端 | 不推荐，除非业务限制该房间不使用 PPT/App/插件并完成验证 |

对于 `white-web-sdk`、`@netless/window-manager`、`@netless/fastboard` 的基础能力，正式版本升级通常不会改变旧房间的基础白板数据。但课件和插件是风险点：

- 动态 PPT：旧 Flat 使用过 `@netless/app-slide@0.3.0-canary.21`，正式接入仍然是 `Slide` kind，但必须验证旧房间持久化的 `taskId`、`url`、`state`、`scenePath` 是否都能被正式版本正确恢复。
- 静态 PPT/PDF：旧 Flat 使用 `@netless/app-docs-viewer@1.0.0-canary.5`，标准文档建议使用 `@netless/app-presentation` 并安装为 `DocsViewer`。旧房间中已经存在的 `DocsViewer` app 需要按实际 scenes 数据验证。
- appliance-plugin：它引入扩展教具状态和 worker/OffscreenCanvas 渲染路径，不建议假设与旧 Flat 房间完全兼容。

### 2.5 SDK 是否内置自动升级、降级或灰度机制？

没有。SDK 不负责客户端版本编排，也不会根据房间自动升级/降级客户应用。

灰度、回滚和新旧版本路由需要客户业务侧实现。推荐方案：

1. 在业务后端为房间记录白板运行时版本，例如：

```json
{
  "roomUUID": "xxx",
  "whiteboardRuntime": "flat-canary",
  "whiteboardRuntimeVersion": "flat-fastboard-canary-2024"
}
```

或：

```json
{
  "roomUUID": "xxx",
  "whiteboardRuntime": "official-fastboard",
  "whiteboardRuntimeVersion": "fastboard-1.1"
}
```

2. 客户端进入房间前先请求房间元信息，根据 runtime 加载对应白板 bundle。
3. 保证同一个 live session 内所有用户使用同一套白板 runtime。
4. 新建房间默认走正式版本，旧房间保留旧版本，按数据类型逐步迁移。
5. 灰度顺序建议：
   - 内部测试房间
   - 少量新建房间
   - 没有课件和插件的存量房间
   - 只有静态课件的存量房间
   - 有动态 PPT 的存量房间
   - 有 appliance-plugin 或自定义插件的房间
6. 保留回滚开关：当检测到课件打开失败、App 不识别、关键错误上升时，后端把该房间 runtime 切回旧栈。

## 3. 面向客户的推荐回复稿

可以这样回复客户：

> 关于按组件 CPU/内存数据：目前我们没有可分享的按 SDK 内部组件拆分的 CPU/内存数据，也没有公开的组件级 CPU/内存性能 hook。Web 白板运行在用户浏览器中，浏览器通常只能提供 tab、进程或 JS heap 级别的资源数据，很难可靠归因到某个 SDK 模块。建议你们在自己的目标设备和真实课件下，用浏览器 Performance/Memory 工具和业务侧埋点采集。我们可以提供推荐采集点，例如 join room、打开 PPT、翻页、缩放、切换工具等关键动作。

> 关于基础工具使用统计：Agora 当前没有可直接分享的按笔、橡皮擦、文字、形状等基础工具拆分的聚合统计。你们可以在客户端订阅房间状态变化事件，监听 `memberState.currentApplianceName`，形状类再结合 `memberState.shapeType`。这可以统计工具选择次数和停留时长。如果要统计真实绘制笔画数或对象变更数，需要在你们自己的 UI 操作层或对象变更层补充埋点。

> 关于后端独立启用/禁用组件：白板后端 API 当前不支持按单个工具或组件启停。可以在前端集成层通过 Fastboard UI config、自定义 toolbar、是否注册 App、是否展示 Apps 入口来控制功能暴露。如果希望从服务端统一配置，可以由业务后端返回 feature flag，前端按配置生成 UI。需要注意这不是后端强权限控制。

> 关于新旧版本兼容和灰度：基础白板房间数据通常可以由正式 `white-web-sdk` / `window-manager` / `fastboard` 继续读取，但旧 Flat canary 栈创建的动态 PPT、静态文档、appliance-plugin 或自定义 App 需要单独验证。不建议在同一个 live session 中混用旧客户端和新客户端。SDK 没有内置自动升级/降级或灰度机制，建议你们按房间或会话维度做 runtime 路由：新建房间走正式版本，旧房间先保持旧版本，验证通过后再分批迁移。

## 4. 建议客户采集的性能指标

| 指标 | 采集方式 | 说明 |
| --- | --- | --- |
| 首次进入白板耗时 | `performance.mark()` 包裹 `createFastboard()` / `joinRoom()` | 反映 SDK 初始化、网络连接、房间状态恢复 |
| 打开动态 PPT 耗时 | 包裹 `insertDocs({ fileType: "pptx" })` 到可操作状态 | 与转换资源大小、网络、浏览器性能强相关 |
| 打开静态文档耗时 | 包裹 `insertDocs({ fileType: "pdf", scenes })` | 与页面数量、图片尺寸、懒加载策略相关 |
| 翻页/动画响应耗时 | 包裹 `dispatchDocsEvent()`，结合 UI 可见状态 | 动态 PPT 和静态文档应分开统计 |
| FPS | `requestAnimationFrame` 采样 | 用于观察绘制、缩放、拖动、PPT 动画 |
| Long Task | `PerformanceObserver` 监听 `longtask` | 观察主线程卡顿 |
| JS Heap | Chrome `performance.memory` 或 DevTools Memory | 仅 Chrome 系浏览器可用，不能跨浏览器统一 |
| Tab 内存 | 浏览器任务管理器或自动化采集 | 适合做版本对比，不适合精确归因到模块 |
| 连接质量 | SDK 内部质量日志、客户侧网络指标 | 用于区分网络问题和渲染问题 |

示例采集片段：

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

Long Task 示例：

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

## 5. 可以提供给客户的调优方向

动态 PPT `@netless/app-slide` 的注册可配置渲染参数，例如标准文档中使用：

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

appliance-plugin 也有一些面向性能/兼容性的选项：

- `useWorker: "auto"`：浏览器支持 OffscreenCanvas 时使用 worker，否则降级主线程
- `useSimple: true`：移动端或低性能设备可考虑简单模式
- `bufferSize`：根据设备性能调整画布缓存
- `useBackgroundThread: false`：没有背景线程能力需求时不要开启

这些选项可以帮助客户按设备能力调优，但仍然不等价于按组件 CPU/内存统计。

## 6. 推荐迁移策略

### 6.1 房间路由

业务服务端保存房间白板运行时：

| runtime | 用途 |
| --- | --- |
| `flat-canary` | 存量旧 Flat 房间，尤其是有旧 PPT/App/插件的房间 |
| `official-fastboard` | 新建房间和已验证兼容的旧房间 |

客户端进入房间前：

1. 请求业务后端获取 `whiteboardRuntime`
2. 加载对应白板 bundle
3. 加入白板房间
4. 上报 runtime、SDK 版本、浏览器、OS、是否打开课件、错误信息

### 6.2 房间预检查

迁移旧房间前建议检查房间是否包含：

- `Slide-*` app
- `DocsViewer-*` app
- 自定义 App kind
- appliance-plugin 相关状态
- 大量白板对象
- 超大静态文档或动态 PPT

如果存在上述内容，应进入专项验证队列，不建议直接切正式版本。

### 6.3 灰度和回滚

建议灰度开关放在客户业务后端，而不是写死在前端包里。

最小回滚能力：

- 可按 roomUUID 切回旧 runtime
- 可按用户、租户、地区关闭正式版本
- 可禁用动态 PPT 或 appliance-plugin 等高风险功能
- 可把新建房间默认 runtime 切回旧版本

## 7. 内部依据摘要

本次代码和文档分析中，与答复相关的关键点如下：

- `FastboardApp.memberState` 直接监听 `room.callbacks.on("onRoomStateChanged")`，并读取 `memberState`。
- `FastboardApp.setAppliance()` 最终调用 `manager.mainView.setMemberState({ currentApplianceName, shapeType })`。
- Fastboard toolbar 默认工具包括 `clicker`、`selector`、`pencil`、`text`、`shapes`、`eraser`、`clear`。
- shapes 包括 `rectangle`、`ellipse`、`straight`、`arrow`、`pentagram`、`rhombus`、`triangle`、`speechBalloon`。
- `app-slide` 也监听 `onRoomStateChanged` 中的 `currentApplianceName` 来控制 click-through 行为，说明该事件是 SDK 内部已使用的状态来源。
- `white-web-sdk` 的质量统计集中在连接、断线、重连、RTT、帧间隔、队列长度等，不是基础工具使用分析。
- `app-docs-viewer` 文档列出的浏览器基线为 Chrome 88+、Firefox 85+、Safari 14+、Edge 88+。
- appliance-plugin 文档说明移动端支持取决于 OffscreenCanvas，不支持时会自动降级到主线程。
- Flat 旧插入逻辑中，旧动态 PPT 通过 `manager.addApp({ kind: "Slide", attributes: { taskId, url } })` 创建；静态文档通过 `BuiltinApps.DocsViewer` 创建；新 Projector PPTX 才走 `fastboardApp.insertDocs()`。

## 8. 最终建议

对客户的主结论建议保持保守：

1. 不承诺 Agora 能提供按组件 CPU/内存数据。
2. 不承诺 Agora 有基础工具使用聚合统计。
3. 明确告诉客户可以通过 `onRoomStateChanged` / `memberState` 自行统计工具选择和停留时长。
4. 明确后端 API 不支持按单个白板组件启停。
5. 明确 SDK 不内置灰度/升级/降级编排。
6. 迁移上建议按房间 runtime 路由，新建房间用正式栈，旧房间按是否包含 PPT/App/插件分批验证。
