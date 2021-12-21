# @netless/fastboard

A whiteboard starter, based on [white-web-sdk](https://www.npmjs.com/package/white-web-sdk), [@netless/window-manager](https://www.npmjs.com/package/@netless/window-manager)
and [netless-app](https://github.com/netless-io/netless-app).

## 目录

- [安装](#安装)
- [使用](#使用)
- [进阶](./docs/advanced.md)
- [开发](#开发)

## 安装

```bash
npm add @netless/fastboard
```

```bash
yarn add @netless/fastboard
```

```bash
pnpm add @netless/fastboard
```

## 使用

### 挂载白板

```js
import { createWhiteboardApp } from "@netless/fastboard";

let whiteboard = createWhiteboardApp({
  target: document.getElementById("whiteboard"),
  // [1]
  sdkConfig: {
    appIdentifier: "whiteboard-appid",
  },
  // [2]
  joinRoom: {
    uid: "unique_id_for_each_client",
    uuid: "room-uuid",
    roomToken: "NETLESSROOM_...",
  },
  // [3]
  managerConfig: {
    cursor: true,
  },
});
```

[1] 关于 SDK 更多配置请看 [构造 WhiteWebSDK](#https://developer.netless.link/javascript-zh/home/construct-white-web-sdk)

[2] 加入房间更多配置请看 [构造 Room 与 Player 对象](#https://developer.netless.link/javascript-zh/home/construct-room-and-player)

[3] 配置 `WindowManager` 请看 [WindowManager](#https://github.com/netless-io/window-manager#mount)

### 使用 APPS

```typescript
// 插入动态 PPTX 至白板
const appId = await whiteboard.insertDocs({
  fileType: "pptx",
  params: {
    scenePath: `/ppt/${uuid}`, // [1]
    title: "a.pptx",
    taskId: "1234567...", // [2]
    url: "https://convertcdn.netless.link/dynamicConvert", // [3]
  },
});

// 插入 PDF/静态 PPT 至白板
const appId = await whiteboard.insertDocs({
  fileType: "pdf", // or ppt
  options: {
    scenePath: `/pdf${uuid}`,
    title: "a.pdf", // 可选
    scenes: [], // SceneDefinition[] 静态/动态 Scene 数据
  },
});

// 插入音频/视频至白板
const appId = await whiteboard.manager.addApp({
  kind: "MediaPlayer",
  options: {
    title: "test.mp3", // 可选
  },
  attributes: {
    src: "xxxx", // 音视频 url
  },
});
```

更多 `app` 请看 [netless-app](#https://github.com/netless-io/netless-app)

## Develop

```bash
pnpm i
# upgrade dependencies
pnpm up -Li
```

## License

MIT @ [netless](https://github.com/netless-io)
