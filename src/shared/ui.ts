type MessageOptions = {
  title: string;
  text?: string;
};

type ActiveModal = {
  overlay: HTMLDivElement;
  modal: HTMLDivElement;
  iconEl: HTMLDivElement;
  titleEl: HTMLDivElement;
  textEl: HTMLDivElement;
  contentEl: HTMLDivElement;
  actionsEl: HTMLDivElement;
  resolve: (value: unknown) => void;
  closeOnClickOutside: boolean;
  escHandler: (event: KeyboardEvent) => void;
};

let activeModal: ActiveModal | null = null;
let stylesInjected = false;

export type ModalTone = 'success' | 'error' | 'warning' | 'info';

export const MODAL_STYLES = `
  .rh-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(17, 24, 39, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    padding: 12px;
    box-sizing: border-box;
  }

  .rh-modal {
    width: min(92vw, 460px);
    max-height: 85vh;
    overflow: auto;
    border-radius: 12px;
    background: #ffffff;
    color: #111827;
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.24);
    padding: 20px;
    box-sizing: border-box;
    font-family: inherit;
  }

  .rh-modal-icon {
    margin: 0 0 10px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    display: inline-flex;
    align-items: center;
    padding: 3px 8px;
    border-radius: 999px;
    background: #e5e7eb;
    color: #374151;
  }

  .rh-modal-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 10px;
    color: #111827;
  }

  .rh-modal-text,
  .rh-modal-content {
    margin: 0 0 16px;
    line-height: 1.6;
    font-size: 14px;
    color: #374151;
    word-break: break-word;
  }

  .rh-modal-content input:not([type]),
  .rh-modal-content input[type="text"],
  .rh-modal-content input[type="password"],
  .rh-modal-content input[type="number"],
  .rh-modal-content textarea,
  .rh-modal-content select {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    color: #111827;
    background: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 14px;
    line-height: 1.4;
  }

  .rh-modal-content input:not([type]):focus,
  .rh-modal-content input[type="text"]:focus,
  .rh-modal-content input[type="password"]:focus,
  .rh-modal-content input[type="number"]:focus,
  .rh-modal-content textarea:focus,
  .rh-modal-content select:focus {
    outline: 2px solid #93c5fd;
    outline-offset: 1px;
    border-color: #60a5fa;
  }

  .rh-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    flex-wrap: wrap;
  }

  .rh-modal-button {
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 8px 14px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
  }

  .rh-modal-button--primary {
    background: #2563eb;
    color: #ffffff;
  }

  .rh-modal-button--secondary {
    background: #f3f4f6;
    border-color: #d1d5db;
    color: #374151;
  }

  .rh-modal-button--danger {
    background: #dc2626;
    color: #ffffff;
  }

  .rh-modal--success {
    border-top: 3px solid #16a34a;
  }

  .rh-modal--error {
    border-top: 3px solid #dc2626;
  }

  .rh-modal--warning {
    border-top: 3px solid #ea580c;
  }

  .rh-modal--info {
    border-top: 3px solid #2563eb;
  }

  .rh-modal-icon--success {
    background: #dcfce7;
    color: #166534;
  }

  .rh-modal-icon--error {
    background: #fee2e2;
    color: #991b1b;
  }

  .rh-modal-icon--warning {
    background: #ffedd5;
    color: #9a3412;
  }

  .rh-modal-icon--info {
    background: #dbeafe;
    color: #1d4ed8;
  }
`;

function getModalTone(icon?: SwalIcon): ModalTone | undefined {
  if (icon === 'success' || icon === 'error' || icon === 'warning' || icon === 'info') {
    return icon;
  }

  return undefined;
}

export function getModalToneClass(icon?: SwalIcon): string {
  const tone = getModalTone(icon);
  return tone ? `rh-modal--${tone}` : '';
}

export function getButtonRoleClass(key: string, tone: ModalTone | undefined): string {
  if (key === 'confirm') {
    return tone === 'error' ? 'rh-modal-button--danger' : 'rh-modal-button--primary';
  }

  return 'rh-modal-button--secondary';
}

function normalizeOptions(optionsOrTitle: SwalOptions | string, text?: string, icon?: SwalIcon): SwalOptions {
  if (typeof optionsOrTitle === 'string') {
    return {
      title: optionsOrTitle,
      text,
      icon,
    } as SwalOptions;
  }

  return optionsOrTitle;
}

function injectStyles(): void {
  if (stylesInjected) return;

  const style = document.createElement('style');
  style.textContent = MODAL_STYLES;

  const mountTarget = document.head ?? document.documentElement;
  mountTarget.appendChild(style);
  stylesInjected = true;
}

function closeActiveModal(value: unknown): void {
  if (!activeModal) return;

  const current = activeModal;
  activeModal = null;

  document.removeEventListener('keydown', current.escHandler);
  current.overlay.remove();
  current.resolve(value);
}

function renderModal(options: SwalOptions): void {
  if (!activeModal) return;

  const { iconEl, titleEl, textEl, contentEl, actionsEl } = activeModal;
  const opts = options as SwalOptions & {
    titleText?: string;
    content?: string | HTMLElement;
    buttons?: Record<string, string | { text?: string }>;
    className?: string;
    closeOnClickOutside?: boolean;
    showCancelButton?: boolean;
    confirmButtonText?: string;
    cancelButtonText?: string;
  };

  const title = opts.titleText ?? opts.title ?? '';
  titleEl.textContent = title;
  titleEl.style.display = title ? '' : 'none';

  iconEl.className = `rh-modal-icon${opts.icon ? ` rh-modal-icon--${opts.icon}` : ''}`;
  iconEl.textContent = opts.icon ?? '';
  iconEl.style.display = opts.icon ? '' : 'none';

  textEl.textContent = opts.text ?? '';
  textEl.style.display = textEl.textContent ? '' : 'none';

  contentEl.innerHTML = '';
  if (typeof opts.content === 'string') {
    contentEl.textContent = opts.content;
  } else if (opts.content instanceof HTMLElement) {
    contentEl.appendChild(opts.content);
  }
  contentEl.style.display = contentEl.textContent || contentEl.childNodes.length ? '' : 'none';

  const toneClass = getModalToneClass(opts.icon);
  const tone = getModalTone(opts.icon);
  activeModal.modal.className = `rh-modal${opts.className ? ` ${opts.className}` : ''}${toneClass ? ` ${toneClass}` : ''}`;

  activeModal.closeOnClickOutside = opts.closeOnClickOutside !== false;

  actionsEl.innerHTML = '';
  const buttons = opts.buttons && Object.keys(opts.buttons).length
    ? opts.buttons
    : opts.showCancelButton
      ? {
          confirm: opts.confirmButtonText || '确定',
          cancel: opts.cancelButtonText || '取消',
        }
      : { confirm: '确定' };

  Object.entries(buttons).forEach(([key, config]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `rh-modal-button ${getButtonRoleClass(key, tone)}`;
    button.textContent = typeof config === 'string' ? config : config?.text || key;
    button.addEventListener('click', () => {
      if (key === 'cancel') {
        closeActiveModal(null);
        return;
      }
      if (key === 'confirm') {
        closeActiveModal(true);
        return;
      }
      closeActiveModal(key);
    });
    actionsEl.appendChild(button);
  });
}

export function showModal(options: SwalOptions): Promise<unknown>;
export function showModal(title: string, text?: string, icon?: SwalIcon): Promise<unknown>;
export function showModal(optionsOrTitle: SwalOptions | string, text?: string, icon?: SwalIcon): Promise<unknown> {
  injectStyles();

  const options = normalizeOptions(optionsOrTitle, text, icon);

  if (activeModal) {
    closeActiveModal(null);
  }

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'rh-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'rh-modal';

    const iconEl = document.createElement('div');
    iconEl.className = 'rh-modal-icon';

    const titleEl = document.createElement('div');
    titleEl.className = 'rh-modal-title';

    const textEl = document.createElement('div');
    textEl.className = 'rh-modal-text';

    const contentEl = document.createElement('div');
    contentEl.className = 'rh-modal-content';

    const actionsEl = document.createElement('div');
    actionsEl.className = 'rh-modal-actions';

    modal.append(iconEl, titleEl, textEl, contentEl, actionsEl);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const escHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && activeModal?.closeOnClickOutside) {
        closeActiveModal(null);
      }
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay && activeModal?.closeOnClickOutside) {
        closeActiveModal(null);
      }
    });

    document.addEventListener('keydown', escHandler);

    activeModal = {
      overlay,
      modal,
      iconEl,
      titleEl,
      textEl,
      contentEl,
      actionsEl,
      resolve,
      closeOnClickOutside: true,
      escHandler,
    };

    renderModal(options);
  });
}

export function updateOrShowModal(options: SwalOptions): void {
  if (activeModal) {
    renderModal(options);
    return;
  }

  void showModal(options);
}

function show(icon: SwalIcon, options: string | MessageOptions): Promise<unknown> {
  const title = typeof options === 'string' ? options : options.title;
  const text = typeof options === 'string' ? undefined : options.text;
  return showModal({ title, text, icon } as SwalOptions);
}

export function info(options: string | MessageOptions): Promise<unknown> {
  return show('info', options);
}

export function success(options: string | MessageOptions): Promise<unknown> {
  return show('success', options);
}

export function error(options: string | MessageOptions): Promise<unknown> {
  return show('error', options);
}
