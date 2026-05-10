export {};

declare global {
  type Platform = 'steam' | 'ig' | 'itch';

  interface UnifiedSettings {
    steam: {
      newTab: boolean;
      copyListen: boolean;
      selectListen: boolean;
      clickListen: boolean;
      allKeyListen: boolean;
      asf: boolean;
      asfProtocol: 'http' | 'https' | string;
      asfHost: string;
      asfPort: number;
      asfPassword: string;
      asfBot: string;
    };
    ig: {
      enableButtons: boolean;
    };
    itch: {
      autoClose: boolean;
    };
  }

  type JQueryLike<TElement = HTMLElement> = {
    [index: number]: TElement;
    length: number;
    text(): string;
    text(value: string): JQueryLike<TElement>;
    html(): string | undefined;
    html(value: string): JQueryLike<TElement>;
    val(): string | string[] | number | undefined;
    val(value: string | number | string[]): JQueryLike<TElement>;
    attr(name: string): string | undefined;
    attr(name: string, value: string): JQueryLike<TElement>;
    css(properties: Record<string, string | number>): JQueryLike<TElement>;
    append(content: unknown): JQueryLike<TElement>;
    remove(): void;
    show(): JQueryLike<TElement>;
    hide(): JQueryLike<TElement>;
    each(callback: (index: number, element: TElement) => void): JQueryLike<TElement>;
  };

  interface JQueryStaticLike {
    <TElement extends HTMLElement = HTMLElement>(selector: string | TElement | Document | Window): JQueryLike<TElement>;
  }

  const $: JQueryStaticLike;

  type SwalIcon = 'success' | 'error' | 'warning' | 'info' | 'question';

  interface SwalOptions {
    title?: string;
    text?: string;
    html?: string | HTMLElement;
    icon?: SwalIcon;
    className?: string;
    content?: HTMLElement;
    buttons?: Record<string, string> | string[] | boolean;
    closeOnClickOutside?: boolean;
  }

  interface SweetAlert2Like {
    fire(options: SwalOptions): Promise<unknown>;
    fire(title: string, text?: string, icon?: SwalIcon): Promise<unknown>;
  }

  function swal(options: SwalOptions): Promise<unknown>;
  function swal(title: string, text?: string, icon?: SwalIcon): Promise<unknown>;

  const Swal: SweetAlert2Like | undefined;
  const unsafeWindow: Window & typeof globalThis;
  const g_sessionID: string | undefined;

  interface GMResponse<T = unknown> {
    finalUrl: string;
    readyState: number;
    status: number;
    statusText: string;
    responseHeaders: string | Record<string, string>;
    response?: T;
    responseText?: string;
    responseXML?: Document;
    context?: unknown;
  }

  interface GMRequestDetails<T = unknown> {
    method?: string;
    url: string | URL | File | Blob;
    headers?: Record<string, string>;
    data?: string | Blob | File | object | unknown[] | FormData | URLSearchParams;
    redirect?: 'follow' | 'error' | 'manual';
    cookie?: string;
    binary?: boolean;
    nocache?: boolean;
    revalidate?: boolean;
    timeout?: number;
    context?: unknown;
    responseType?: 'arraybuffer' | 'blob' | 'json' | 'stream' | 'text';
    dataType?: 'arraybuffer' | 'blob' | 'json' | 'stream' | 'text';
    overrideMimeType?: string;
    anonymous?: boolean;
    fetch?: boolean;
    user?: string;
    password?: string;
    onabort?: (response: GMResponse<T>) => void;
    onerror?: (response: GMResponse<T>) => void;
    onloadstart?: (response: GMResponse<T>) => void;
    onprogress?: (response: GMResponse<T>) => void;
    onreadystatechange?: (response: GMResponse<T>) => void;
    ontimeout?: (response: GMResponse<T>) => void;
    onload?: (response: GMResponse<T>) => void;
  }

  interface GMRequestObject {
    abort: () => void;
  }

  interface GMCookie {
    name: string;
    value: string;
  }

  interface GMCookieError {
    message?: string;
  }

  const GM_cookie: {
    list(details: { url: string }, callback: (cookies: GMCookie[], error: GMCookieError | null) => void): void;
  };

  type GMValue = string | number | boolean | null | undefined | object | unknown[];

  function GM_xmlhttpRequest<T = unknown>(details: GMRequestDetails<T>): GMRequestObject;
  function GM_setValue(key: string, value: GMValue): void;
  function GM_getValue<T>(key: string, defaultValue?: T): T;
  function GM_setClipboard(data: string, info?: 'text' | 'html' | { type: 'text' | 'html'; mimetype?: string }, cb?: () => void): void;
  function GM_addStyle(css: string): HTMLStyleElement;
  function GM_registerMenuCommand(name: string, callback: (event?: MouseEvent | KeyboardEvent) => void, options?: { id?: number | string; accessKey?: string; autoClose?: boolean; title?: string }): number | string;

  namespace GM {
    function xmlHttpRequest<T = unknown>(details: GMRequestDetails<T>): Promise<GMResponse<T>> & { abort: () => void };
    function setValue(key: string, value: GMValue): Promise<void>;
    function getValue<T>(key: string, defaultValue?: T): Promise<T>;
    function setClipboard(data: string, info?: 'text' | 'html' | { type: 'text' | 'html'; mimetype?: string }): Promise<void>;
    function addStyle(css: string): Promise<HTMLStyleElement>;
    function registerMenuCommand(name: string, callback: (event?: MouseEvent | KeyboardEvent) => void, options?: { id?: number | string; accessKey?: string; autoClose?: boolean; title?: string }): Promise<number | string>;
  }
}
