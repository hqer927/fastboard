import React, { useCallback } from "react";
import { Instance } from "../internal";
import { RedoUndo } from "./RedoUndo";
import { Toolbar } from "./Toolbar";
import { ZoomControl } from "./ZoomControl";

export interface RootProps {
  instance: Instance;
}

export default function Root({ instance: app }: RootProps) {
  const useWhiteboard = useCallback(
    (container: HTMLDivElement | null) =>
      container ? app.mount(container) : app.unmount(),
    [app]
  );

  return (
    <div className="fastboard-root">
      <div className="fastboard-view" ref={useWhiteboard} />
      <div className="fastboard-bottom-left">
        <RedoUndo room={app.room} manager={app.manager} />
        <ZoomControl room={app.room} manager={app.manager} />
      </div>
      <Toolbar room={app.room} manager={app.manager} />
    </div>
  );
}

export function useInstance() {
  const app = React.useContext(Instance.Context);
  if (!app) {
    throw new Error("useInstance must be used within a WhiteboardApp");
  }
  return app;
}