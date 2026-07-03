# Fastboard Web Document Integration Guide (Customer Version)

This document explains how to integrate Fastboard into a Web project and enable:

- Dynamic PPT: `@netless/app-slide`
- Static PPT / PDF: `@netless/app-presentation` (recommended to be installed as `DocsViewer`)

## 1. Recommended Integration Approach

If your Web project is based on React, we recommend using:

```bash
pnpm add @netless/fastboard-react @netless/app-slide @netless/app-presentation
```

If the project is not based on React, you can also use:

```bash
pnpm add @netless/fastboard @netless/app-slide @netless/app-presentation
```

Recommended principles:

- For React projects, prioritize `@netless/fastboard-react`
- Use `@netless/app-slide` for dynamic PPT
- Use `@netless/app-presentation` for static PPT, static documents, and PDF, and install it as `DocsViewer`

## 2. Difference Between Dynamic PPT and Static PPT

### Dynamic PPT: `Slide`

Applicable scenarios:

- Dynamic presentation of `.pptx`
- Scenarios where animations, step-by-step playback, and dynamic page switching need to be preserved

Characteristics:

- Depends on dynamic file conversion results
- The app kind after opening is `Slide`
- Page control can be done through `appResult.prevPage()`, `nextPage()`, and `jumpToPage()`

### Static PPT / PDF: `DocsViewer`

Applicable scenarios:

- Static PPT
- PDF
- Other documents that have already been converted into images

Characteristics:

- Depends on static file conversion results
- Essentially displays documents page by page as images
- Does not preserve PPT animations
- Better suited for document browsing, courseware presentation, and PDF preview

## 3. File Conversion Service Is a Prerequisite

Whether it is dynamic PPT or static PPT / PDF, Fastboard SDK cannot directly read the original file.

Before opening a document on the frontend, the business side must first use Agora's file conversion service to convert the source file into parameters that the SDK can consume.

Official reference:

- [Agora File conversion overview](https://docs.agora.io/en/interactive-whiteboard/develop/file-conversion-overview)

According to the official documentation:

- Static file conversion converts PPT, PPTX, DOC, DOCX, and PDF into PNG / JPG(JPEG) images without preserving animations
- Dynamic file conversion converts PPT / PPTX into HTML Web page resources while preserving animations

In other words:

- `Slide` consumes dynamic conversion results
- `DocsViewer` consumes static conversion results

## 4. Preparations Before Integration

Before formal integration, the following preparation work should be completed:

1. Enable the file conversion service in Agora Console
2. Configure third-party storage for storing conversion output
3. Ensure that the data center used for file conversion matches the whiteboard room `region`
4. Ensure that the business backend can call Agora file conversion REST APIs

Additional recommendations:

- Use `.pptx` as the preferred source format for dynamic conversion
- If static conversion quality is not ideal, you may first convert the source file to PDF and then perform static conversion

## 5. Responsibility Split Between Backend and Frontend

### Backend Responsibilities

The backend is usually responsible for:

1. Uploading source files to accessible storage
2. Calling Agora file conversion REST APIs to start conversion tasks
3. Polling task progress until conversion is completed
4. Returning conversion results to the frontend

The backend typically needs to return two types of data to the frontend:

- Parameters required for dynamic PPT: `taskId`, `url`, `title`
- Parameters required for static documents: page-by-page `scenes` data, `title`

### Frontend Responsibilities

The frontend is usually responsible for:

1. Registering `Slide` and `DocsViewer`
2. Initializing Fastboard
3. Calling `insertDocs()` with the conversion result returned by the backend
4. Saving the returned `appId`
5. Precisely controlling a specific document instance using `appId`

## 6. Recommended Backend Response Data Structure

To reduce frontend integration complexity, we recommend that the backend does not directly pass through the raw result returned by the file conversion service. Instead, it should normalize the data into a fixed structure.

### 6.1 Recommended Response for Dynamic PPT

```json
{
  "type": "dynamic-ppt",
  "title": "demo.pptx",
  "taskId": "82d16c40b15745f0b5fad096ac721773",
  "url": "https://convertcdn.netless.link/dynamicConvert",
  "scenePath": "/pptx/82d16c40b15745f0b5fad096ac721773"
}
```

After receiving this payload, the frontend can directly call:

```ts
fastboard.insertDocs({
  fileType: "pptx",
  scenePath,
  taskId,
  title,
  url,
});
```

### 6.2 Recommended Response for Static PPT / PDF

```json
{
  "type": "static-docs",
  "title": "lesson.pdf",
  "scenePath": "/pdf/lesson-001",
  "scenes": [
    {
      "name": "1",
      "ppt": {
        "src": "https://example.com/1.png",
        "width": 714,
        "height": 1010
      }
    },
    {
      "name": "2",
      "ppt": {
        "src": "https://example.com/2.png",
        "width": 714,
        "height": 1010
      }
    }
  ]
}
```

After receiving this payload, the frontend can directly call:

```ts
fastboard.insertDocs({
  fileType: "pdf",
  scenePath,
  title,
  scenes,
});
```

### 6.3 Why Backend Normalization Is Recommended

Main benefits:

- The frontend does not need to understand the raw file conversion response format
- Dynamic and static documents can be unified under a stable data contract
- If the conversion service implementation changes later, frontend changes will be smaller
- It is easier for the backend to implement permission control, caching, and retries

## 7. Dynamic PPT Integration

### 7.1 Register `Slide`

`Slide` needs to be registered before joining the room:

```ts
import { register } from "@netless/fastboard-react";

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

### 7.2 Open Dynamic PPT

After the backend completes dynamic file conversion, the frontend can open the document using the following parameters:

```ts
const appId = await fastboard.insertDocs({
  fileType: "pptx",
  scenePath: `/pptx/${taskId}`,
  taskId,
  title: "demo.pptx",
  url,
});
```

Parameter description:

- `taskId`: file conversion task ID
- `url`: dynamic resource prefix
- `scenePath`: unique whiteboard scene path
- `title`: window title

The most important point here is:

- `taskId` and `url` must come from the file conversion result
- The frontend cannot construct dynamic PPT content by itself

### 7.3 Control a Specific Dynamic PPT

After opening successfully, you will usually get an `appId`, for example:

```ts
Slide-fdf169a0
```

Then you can get the corresponding instance through `appId`:

```ts
const app = fastboard.manager.queryOne(appId);
const controller = app?.appResult;
```

Page control APIs:

```ts
controller?.prevPage();
controller?.nextPage();
controller?.jumpToPage(3);
```

Notes:

- `jumpToPage(page)` uses 1-based page indexing
- `jumpToPage(1)` means jumping to the first page

If you already know the instance ID, you can also call it directly:

```ts
fastboard.manager.queryOne("Slide-fdf169a0")?.appResult?.prevPage();
fastboard.manager.queryOne("Slide-fdf169a0")?.appResult?.nextPage();
fastboard.manager.queryOne("Slide-fdf169a0")?.appResult?.jumpToPage(3);
```

## 8. Static PPT / PDF Integration

### 8.1 Register `DocsViewer`

It is recommended to install it as `DocsViewer`:

```ts
import { register } from "@netless/fastboard-react";
import { install } from "@netless/app-presentation";

install(register, {
  as: "DocsViewer",
  appOptions: {
    useScrollbar: true,
    debounceSync: true,
    maxCameraScale: 5,
    useClipView: true,
  },
});
```

### 8.2 Open Static PPT / PDF

When opening static documents, the frontend needs to receive page-by-page image information from the file conversion service and organize it into `scenes`:

```ts
const appId = await fastboard.insertDocs({
  fileType: "pdf",
  scenePath: `/pdf/${taskId}`,
  title: "lesson.pdf",
  scenes: [
    {
      name: "1",
      ppt: {
        src: "https://example.com/1.png",
        width: 714,
        height: 1010,
      },
    },
    {
      name: "2",
      ppt: {
        src: "https://example.com/2.png",
        width: 714,
        height: 1010,
      },
    },
  ],
});
```

Key points here:

- `scenes[].ppt.src` comes from the image URL of each converted page
- `scenes[].ppt.width` / `height` come from the page size
- `DocsViewer` does not open the original document, but the converted image resource set

### 8.3 Control a Specific Static Document

If the static document is opened via `DocsViewer`, it is recommended to use the unified document control API:

```ts
import { dispatchDocsEvent } from "@netless/fastboard";

dispatchDocsEvent(fastboard, "prevPage", { appId });
dispatchDocsEvent(fastboard, "nextPage", { appId });
dispatchDocsEvent(fastboard, "jumpToPage", { appId, page: 3 });
```

## 9. Expand PPT to Fullscreen

If you need the document window to enter Fastboard's fullscreen presentation mode, you can call:

```ts
fastboard.manager.setFullscreen(true);
```

To exit:

```ts
fastboard.manager.setFullscreen(false);
```

Please note:

- This is the fullscreen presentation mode of `window-manager`
- It is mainly used to hide the window title bar and switch to a layout more suitable for presentation
- It is not the browser's native Fullscreen API

## 10. Insert an Image into a Specific PPT

If the customer has a requirement to "insert an image into a PPT", the recommended interpretation is:

- Locate a specific dynamic PPT instance that has already been opened
- Insert an image into the whiteboard view hosted by that PPT

It is important to distinguish the following:

- This does not modify the original PPT file itself
- Instead, it overlays an image object onto the whiteboard view hosted by that PPT

### 10.1 Recommended Calling Method

```ts
const app = fastboard.manager.queryOne("Slide-fdf169a0");
const view = app?.view;

if (view) {
  const uuid = "test-ooo1";
  const src = "https://p5.ssl.qhimg.com/t01a2bd87890397464a.png";

  view.insertImage({
    uuid,
    centerX: 0,
    centerY: 0,
    width: 100,
    height: 100,
    locked: false,
    crossOrigin: true,
  });

  view.completeImageUpload(uuid, src);
}
```

Explanation:

- `insertImage()` first creates the image object
- `completeImageUpload(uuid, src)` then binds the image object to the actual image URL
- These two steps are typically used together

### 10.2 Why This Calling Method Is Recommended

The customer's example is:

```ts
fastboard.manager.queryOne("Slide-fdf169a0").view.insertImage({
  uuid: "test-ooo1",
  centerX: 0,
  centerY: 0,
  width: 100,
  height: 100,
  locked: false,
  crossOrigin: true,
  src: "https://p5.ssl.qhimg.com/t01a2bd87890397464a.png",
});
```

The more recommended approach is still to split it into two steps:

```ts
view.insertImage(imageInfo);
view.completeImageUpload(uuid, src);
```

Because this better aligns with the standard image insertion flow of the whiteboard and `window-manager`.

### 10.3 Usage Notes

- Only Apps that have a `view` can support image insertion; `Slide` is one of them
- The image URL must be accessible
- If there is cross-origin access, it is recommended to enable `crossOrigin: true`
- `uuid` must be unique
- `centerX`, `centerY`, `width`, and `height` control the position and size of the image on the whiteboard
- The inserted image becomes part of the whiteboard content and will be synchronized across participants

## 11. FAQ

### Q1: Why can't the SDK open the original PPT / PDF file directly?

Because Fastboard opens not the original file, but the result generated by the file conversion service:

- Dynamic PPT uses converted HTML Web resources
- Static documents use page-by-page converted image resources

### Q2: How should I choose between dynamic PPT and static PPT?

Recommended principles:

- If animations and step-by-step playback must be preserved, choose dynamic PPT `Slide`
- If the use case is only courseware browsing, PDF preview, or static documents, choose static `DocsViewer`

### Q3: Why is `.pptx` preferred?

According to Agora's official documentation, `PPTX` has better compatibility. `PPT` is usually converted to `PPTX` first on the backend before parsing, so `.pptx` is preferred.

### Q4: Why are some PPT animations, fonts, or styles not exactly the same as the original?

This is usually due to file conversion compatibility limitations. Agora's official documentation mentions:

- Dynamic conversion is more suitable for PPT / PPTX generated by Microsoft Office
- WPS files are not fully supported
- Some fonts, animations, and special effects have compatibility limitations

### Q5: Why is it sometimes recommended to convert to PDF first before static conversion?

According to Agora's official documentation, PDF usually produces more accurate image results in static conversion. If static PPT conversion quality is not ideal, converting to PDF first is usually more stable.

### Q6: Why are very large files or too many pages not recommended for static conversion?

According to Agora's official documentation:

- Files with fewer than 50 pages usually have better static conversion results
- Files with more than 100 pages have a higher risk of conversion timeout

## 12. Recommended End-to-End Workflow

A standard workflow is as follows:

1. The customer uploads the source file to business storage
2. The backend calls Agora file conversion APIs to start the task
3. The backend polls the conversion progress
4. After conversion is completed, the backend returns either dynamic or static results to the frontend
5. The frontend initializes Fastboard and registers `Slide` / `DocsViewer` in advance
6. The frontend calls `fastboard.insertDocs()` to open the document
7. The frontend saves the returned `appId`
8. The business side calls APIs such as page navigation, page jump, and fullscreen as needed

## 13. Common Notes

- For dynamic PPT, `.pptx` is strongly recommended instead of the older `.ppt` format
- Dynamic conversion is suitable for courseware that needs animation
- Static conversion is suitable for regular courseware browsing, PDF preview, and document presentation
- The data center used by the file conversion service must match the whiteboard room `region`
- The final input for static documents is `scenes`
- The final input for dynamic documents is `taskId` + `url`
- Third-party storage must be accessible from the client side
- If image resources are cross-origin, it is recommended to explicitly set `crossOrigin` when inserting images on the frontend

## 14. Minimal Reusable Example

```ts
import { register } from "@netless/fastboard-react";
import { install } from "@netless/app-presentation";

export function setupNetlessApps() {
  register({
    kind: "Slide",
    src: () => import("@netless/app-slide"),
  });

  install(register, {
    as: "DocsViewer",
  });
}

export async function openDynamicPPT(fastboard: any, taskId: string, title: string, url?: string) {
  return fastboard.insertDocs({
    fileType: "pptx",
    scenePath: `/pptx/${taskId}`,
    taskId,
    title,
    url,
  });
}

export async function openStaticDocs(fastboard: any, scenePath: string, title: string, scenes: any[]) {
  return fastboard.insertDocs({
    fileType: "pdf",
    scenePath,
    title,
    scenes,
  });
}

export function fullscreen(manager: any) {
  manager.setFullscreen(true);
}

export function prevDynamicPage(manager: any, appId: string) {
  return manager.queryOne(appId)?.appResult?.prevPage();
}

export function nextDynamicPage(manager: any, appId: string) {
  return manager.queryOne(appId)?.appResult?.nextPage();
}

export function jumpDynamicPage(manager: any, appId: string, page: number) {
  return manager.queryOne(appId)?.appResult?.jumpToPage(page);
}

export function insertImageToSlide(manager: any, appId: string, params: {
  uuid: string;
  src: string;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  locked?: boolean;
  crossOrigin?: boolean | string;
}) {
  const view = manager.queryOne(appId)?.view;
  if (!view) {
    throw new Error("Slide view not found");
  }

  view.insertImage({
    uuid: params.uuid,
    centerX: params.centerX,
    centerY: params.centerY,
    width: params.width,
    height: params.height,
    locked: params.locked ?? false,
    crossOrigin: params.crossOrigin ?? true,
  });

  view.completeImageUpload(params.uuid, params.src);
}
```

## 15. Conclusion

For Web integration scenarios, the recommended standard approach is:

- Use `@netless/fastboard-react` as the frontend whiteboard container
- Use `@netless/app-slide` for dynamic PPT
- Use `@netless/app-presentation` as `DocsViewer` for static PPT / PDF
- Use Agora file conversion service to generate dynamic or static document resources first
- Let the frontend call `insertDocs()` with the conversion result to open the document
- Use `appId` to precisely control a specific document instance
