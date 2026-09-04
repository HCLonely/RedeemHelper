declare const unsafeWindow: Window & typeof globalThis & Record<string, unknown>;

type InlineAction = (element: HTMLElement) => void;

/**
 * Makes a sandboxed userscript callback callable by an inline page handler.
 * A fresh name prevents collisions with both the page and earlier script loads.
 */
export function exposeInlineAction(action: InlineAction): string {
  let name = '';

  do {
    name = `f${crypto.getRandomValues(new Uint32Array(2)).join('')}`;
  } while (typeof unsafeWindow[name] !== 'undefined');

  unsafeWindow[name] = action;
  return name;
}

export function setInlineAction(button: HTMLElement, actionName: string): void {
  button.setAttribute('onclick', `${actionName}(this)`);
}
