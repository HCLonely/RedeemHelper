type MessageOptions = {
  title: string;
  text?: string;
};

export function showModal(options: SwalOptions): Promise<unknown>;
export function showModal(title: string, text?: string, icon?: SwalIcon): Promise<unknown>;
export function showModal(optionsOrTitle: SwalOptions | string, text?: string, icon?: SwalIcon): Promise<unknown> {
  if (typeof swal === 'function') {
    return typeof optionsOrTitle === 'string' ? swal(optionsOrTitle, text, icon) : swal(optionsOrTitle);
  }

  if (typeof Swal !== 'undefined' && Swal?.fire) {
    return typeof optionsOrTitle === 'string' ? Swal.fire(optionsOrTitle, text, icon) : Swal.fire(optionsOrTitle);
  }

  return Promise.resolve(undefined);
}

function show(icon: SwalIcon, options: string | MessageOptions): Promise<unknown> {
  const title = typeof options === 'string' ? options : options.title;
  const text = typeof options === 'string' ? undefined : options.text;
  return showModal({ title, text, icon });
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
