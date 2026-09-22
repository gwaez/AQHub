import type { WizardAction, WizardActionResult } from "../actions/wizard-action.ts";
import type { AqHubApi } from "../api/aqhub-client.ts";
import { WizardSettingsStore } from "../settings/wizard-settings.ts";
import { WizardStateMachine, stateFromVisible, type StateContext } from "../state/wizard-state-machine.ts";

export interface CharacterWindowPort {
  show(): Promise<void>;
  hide(): Promise<void>;
  openAqHub(): Promise<void>;
  exit(): Promise<void>;
  setPosition(x: number, y: number): Promise<void>;
}

export interface WizardPorts {
  api: AqHubApi;
  window: CharacterWindowPort;
  settings?: WizardSettingsStore;
}

function ctx(ports: WizardPorts): StateContext {
  const s = ports.settings?.current;
  return {
    displayName: s?.displayName || "",
    scale: s?.window.scale ?? 1,
    nowMs: Date.now(),
  };
}

/**
 * Action Engine — the only place that talks to AQHub / window ports.
 * Animations subscribe to the state machine after this returns.
 */
export async function dispatch(
  action: WizardAction,
  ports: WizardPorts,
  machine: WizardStateMachine,
): Promise<WizardActionResult> {
  const settings = ports.settings ?? new WizardSettingsStore(ports.api);
  ports.settings = settings;
  const c = () => ctx(ports);

  try {
    switch (action.type) {
      case "SHOW": {
        await ports.window.show();
        await settings.save({ visible: true });
        machine.enter("IDLE", c());
        return { ok: true, action };
      }
      case "HIDE": {
        await ports.window.hide();
        await settings.save({ visible: false });
        machine.enter("HIDDEN", c());
        return { ok: true, action };
      }
      case "OPEN_AQHUB": {
        await ports.window.openAqHub();
        return { ok: true, action };
      }
      case "EXIT": {
        await ports.window.exit();
        return { ok: true, action };
      }
      case "RENAME_DISPLAY": {
        await settings.save({ displayName: action.displayName });
        machine.update(c(), 0);
        return { ok: true, action };
      }
      case "SET_SCALE": {
        await settings.save({ window: { ...settings.current.window, scale: action.scale } });
        machine.update(c(), 0);
        return { ok: true, action };
      }
      case "SET_POSITION": {
        await ports.window.setPosition(action.x, action.y);
        await settings.save({ window: { ...settings.current.window, x: action.x, y: action.y } });
        return { ok: true, action };
      }
      case "PING_HEALTH": {
        const health = await ports.api.health();
        return { ok: true, action, health };
      }
      case "LOAD_SETTINGS": {
        const loaded = await settings.load();
        machine.enter(stateFromVisible(loaded.visible), c());
        if (loaded.visible) await ports.window.show();
        else await ports.window.hide();
        if (loaded.window.x != null && loaded.window.y != null) {
          await ports.window.setPosition(loaded.window.x, loaded.window.y);
        }
        return { ok: true, action };
      }
      case "WATCH": {
        machine.enter("WATCHING", c());
        return { ok: true, action };
      }
      case "IDLE": {
        if (machine.state !== "HIDDEN") machine.enter("IDLE", c());
        return { ok: true, action };
      }
      default: {
        const _never: never = action;
        return { ok: false, action: _never, error: "unknown_action" };
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, action, error: message };
  }
}
