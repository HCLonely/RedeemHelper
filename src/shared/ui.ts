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
  style.textContent = `
    .rh-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
    }

    .rh-modal {
      width: min(90vw, 420px);
      max-height: 85vh;
      overflow: auto;
      border-radius: 10px;
      background: #fff;
      color: #222;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.25);
      padding: 16px;
      box-sizing: border-box;
      font-family: inherit;
    }

    .rh-modal-icon {
      margin: 0 0 8px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .rh-modal-title {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 8px;
    }

    .rh-modal-text,
    .rh-modal-content {
      margin: 0 0 12px;
      line-height: 1.5;
      word-break: break-word;
    }

    .rh-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .rh-modal-button {
      border: none;
      border-radius: 6px;
      padding: 8px 14px;
      background: #2f80ed;
      color: #fff;
      cursor: pointer;
      font-size: 14px;
    }
  `;

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

  activeModal.modal.className = 'rh-modal';
  if (opts.className) {
    activeModal.modal.classList.add(...opts.className.split(/\s+/).filter(Boolean));
  }

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
    button.className = 'rh-modal-button';
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
