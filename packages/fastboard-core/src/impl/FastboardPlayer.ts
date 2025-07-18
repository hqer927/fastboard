import type { MountParams, NetlessApp, PublicEvent } from "@netless/window-manager";
import type {
  Player,
  PlayerPhase as PlayerPhaseEnum,
  PlayerCallbacks,
  PlayerState,
  PlayerSeekingResult,
  ReplayRoomParams,
  ViewCallbacks,
  WhiteWebSdkConfiguration,
} from "white-web-sdk";
import type { SyncedStore } from "@netless/synced-store";

import { WhiteWebSdk } from "white-web-sdk";
import { WindowManager } from "@netless/window-manager";
import { SyncedStorePlugin } from "@netless/synced-store";
import { readable, writable } from "../utils";
import { ensure_official_plugins } from "../internal";
import { register } from "../behaviors/lite";
import type {
  AppliancePluginOptions,
  AppliancePluginInstance,
  ApplianceMultiPlugin,
} from "@netless/appliance-plugin";
import type {
  AppInMainViewPlugin,
  AppInMainViewOptions,
  AppInMainViewInstance,
} from "@netless/app-in-mainview-plugin";
function noop() {}

class FastboardPlayerBase<TEventData extends Record<string, any> = any> {
  public constructor(
    readonly sdk: WhiteWebSdk,
    readonly player: Player,
    readonly manager: WindowManager,
    readonly syncedStore: SyncedStore<TEventData>,
    readonly appliancePlugin?: AppliancePluginInstance,
    readonly appInMainViewPlugin?: AppInMainViewInstance
  ) {}

  protected _destroyed = false;
  /** @internal */
  protected _assertNotDestroyed() {
    if (this._destroyed) {
      throw new Error("FastboardApp has been destroyed");
    }
  }

  /** @internal */
  protected _addPlayerListener<K extends keyof PlayerCallbacks>(name: K, listener: PlayerCallbacks[K]) {
    if (this._destroyed) return noop;
    this.player.callbacks.on(name, listener);
    return () => this.player.callbacks.off(name, listener);
  }

  /** @internal */
  protected _addManagerListener<K extends keyof PublicEvent>(
    name: K,
    listener: (value: PublicEvent[K]) => void
  ) {
    if (this._destroyed) return noop;
    this.manager.emitter.on(name, listener);
    return () => this.manager.emitter.off(name, listener);
  }

  /** @internal */
  protected _addMainViewListener<K extends keyof ViewCallbacks>(name: K, listener: ViewCallbacks[K]) {
    if (this._destroyed) return noop;
    this.manager.mainView.callbacks.on(name, listener);
    return () => this.manager.mainView.callbacks.off(name, listener);
  }

  public destroy() {
    this._destroyed = true;
    this.manager.destroy();
    this.appliancePlugin?.destroy();
    this.appInMainViewPlugin?.destroy();
    return this.player.callbacks.off();
  }
}

type PlayerPhase = `${PlayerPhaseEnum}`;

export type { PlayerPhase, PlayerSeekingResult };

export class FastboardPlayer<
  TEventData extends Record<string, any> = any,
> extends FastboardPlayerBase<TEventData> {
  /**
   * Render this player to some DOM.
   */
  bindContainer(container: HTMLElement) {
    this._assertNotDestroyed();
    this.manager.bindContainer(container);
  }

  /**
   * Move window-manager's collector to some place.
   */
  bindCollector(container: HTMLElement) {
    this._assertNotDestroyed();
    this.manager.bindCollectorContainer(container);
  }

  /**
   * Player current time in milliseconds.
   */
  readonly currentTime = writable(
    this.player.progressTime,
    set => {
      set(this.player.progressTime);
      return this._addPlayerListener("onProgressTimeChanged", set);
    },
    this.player.seekToProgressTime.bind(this.player)
  );

  /**
   * Player state, like "is it playing?".
   */
  readonly phase = readable<PlayerPhase>(this.player.phase, set => {
    set(this.player.phase);
    return this._addPlayerListener("onPhaseChanged", set);
  });

  /**
   * Will become true after buffering.
   */
  readonly canplay = readable(this.player.isPlayable, set => {
    set(this.player.isPlayable);
    return this._addPlayerListener("onIsPlayableChanged", set);
  });

  /** @internal */
  private _setPlaybackRate!: (value: number) => void;
  /**
   * Playback speed, default `1`.
   */
  readonly playbackRate = writable(
    this.player.playbackSpeed,
    set => {
      this._setPlaybackRate = set;
      set(this.player.playbackSpeed);
    },
    value => {
      this.player.playbackSpeed = value;
      this._setPlaybackRate(value);
    }
  );

  /**
   * Playback duration in milliseconds.
   */
  readonly duration = readable(this.player.timeDuration, set => {
    set(this.player.timeDuration);
  });

  /**
   * Get state of room at that time, like "who was in the room?".
   */
  readonly state = readable<PlayerState>(this.player.state, set => {
    set(this.player.state);
    return this._addPlayerListener("onPlayerStateChanged", () => set(this.player.state));
  });

  /**
   * Seek to some time in milliseconds.
   */
  seek(timestamp: number) {
    this._assertNotDestroyed();
    return this.player.seekToProgressTime(timestamp);
  }

  /**
   * Change player state to playing.
   */
  play() {
    this._assertNotDestroyed();
    this.player.play();
  }

  /**
   * Change player state to paused.
   */
  pause() {
    this._assertNotDestroyed();
    this.player.pause();
  }

  /**
   * Change player state to stopped.
   */
  stop() {
    this._assertNotDestroyed();
    this.player.stop();
  }

  /**
   * Set playback speed, a shortcut for `speed.set(x)`.
   */
  setPlaybackRate(value: number) {
    this._assertNotDestroyed();
    this.playbackRate.set(value);
  }
}

export interface FastboardReplayOptions {
  sdkConfig: Omit<WhiteWebSdkConfiguration, "useMobXState"> & {
    region: NonNullable<WhiteWebSdkConfiguration["region"]>;
  };
  replayRoom: Omit<ReplayRoomParams, "useMultiViews"> & {
    callbacks?: Partial<PlayerCallbacks>;
  };
  managerConfig?: Omit<MountParams, "room">;
  netlessApps?: NetlessApp[];
  enableAppliancePlugin?: AppliancePluginOptions;
  enableAppInMainViewPlugin?: true | AppInMainViewOptions;
}

/**
 * Create a FastboardPlayer instance.
 * @example
 * let player = await replayFastboard({
 *   sdkConfig: {
 *     appIdentifier: import.meta.env.VITE_APPID,
 *     region: 'cn-hz',
 *   },
 *   replayRoom: {
 *     room: "room uuid",
 *     roomToken: "NETLESSROOM_...",
 *     beginTimestamp: 1646619090394,
 *     duration: 70448,
 *   },
 * })
 */
export async function replayFastboard<TEventData extends Record<string, any> = any>({
  sdkConfig,
  replayRoom: { callbacks, ...replayRoomParams },
  managerConfig,
  netlessApps,
  enableAppliancePlugin,
  enableAppInMainViewPlugin,
}: FastboardReplayOptions) {
  const isEnableAppliancePlugin =
    enableAppliancePlugin?.cdn.fullWorkerUrl && enableAppliancePlugin?.cdn.subWorkerUrl ? true : false;

  const replayRoomParamsWithPlugin = ensure_official_plugins(replayRoomParams);
  let _ApplianceMultiPlugin: typeof ApplianceMultiPlugin | undefined;
  if (isEnableAppliancePlugin) {
    const { ApplianceMultiPlugin } = await import("@netless/appliance-plugin");
    _ApplianceMultiPlugin = ApplianceMultiPlugin;
    if (replayRoomParamsWithPlugin.invisiblePlugins) {
      replayRoomParamsWithPlugin.invisiblePlugins = [
        ...replayRoomParamsWithPlugin.invisiblePlugins,
        _ApplianceMultiPlugin,
      ];
    }

    if (managerConfig) {
      managerConfig.supportAppliancePlugin = true;
    }
  }
  let _AppInMainViewPlugin: typeof AppInMainViewPlugin | undefined;
  if (enableAppInMainViewPlugin && replayRoomParamsWithPlugin.invisiblePlugins) {
    const { AppInMainViewPlugin } = await import("@netless/app-in-mainview-plugin");
    _AppInMainViewPlugin = AppInMainViewPlugin;
    replayRoomParamsWithPlugin.invisiblePlugins = [
      ...replayRoomParamsWithPlugin.invisiblePlugins,
      _AppInMainViewPlugin,
    ];
  }

  const sdk = new WhiteWebSdk({
    ...sdkConfig,
    useMobXState: true,
  });

  if (netlessApps) {
    netlessApps.forEach(app => {
      register({ kind: app.kind, src: app });
    });
  }

  const player = await sdk.replayRoom(
    {
      ...replayRoomParamsWithPlugin,
      useMultiViews: true,
    },
    callbacks
  );

  const syncedStore = await SyncedStorePlugin.init<TEventData>(player);

  const managerPromise = WindowManager.mount({
    cursor: true,
    ...managerConfig,
    room: player,
  });
  player.play();
  const manager = await managerPromise;
  let appliancePluginInstance: AppliancePluginInstance | undefined;
  if (isEnableAppliancePlugin && enableAppliancePlugin && _ApplianceMultiPlugin) {
    appliancePluginInstance = await _ApplianceMultiPlugin.getInstance(manager, {
      options: enableAppliancePlugin,
    });
  }
  let appInMainViewPluginInstance: AppInMainViewInstance | undefined;
  if (enableAppInMainViewPlugin && _AppInMainViewPlugin) {
    appInMainViewPluginInstance = await _AppInMainViewPlugin.getInstance(
      manager,
      enableAppInMainViewPlugin === true ? undefined : enableAppInMainViewPlugin
    );
  }
  player.pause();
  await player.seekToProgressTime(0);

  return new FastboardPlayer<TEventData>(
    sdk,
    player,
    manager,
    syncedStore,
    appliancePluginInstance,
    appInMainViewPluginInstance
  );
}
