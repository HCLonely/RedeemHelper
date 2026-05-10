type MessageOptions = {
  title: string;
  text?: string;
};

function show(icon: SwalIcon, options: string | MessageOptions): Promise<unknown> {
  const title = typeof options === 'string' ? options : options.title;
  const text = typeof options === 'string' ? undefined : options.text;

  if (typeof Swal !== 'undefined' && Swal?.fire) {
    return Swal.fire({ title, text, icon });
  }

  return swal({ title, text, icon });
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
