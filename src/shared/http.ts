export type RequestBody = GMRequestDetails['data'];

export interface RequestOptions<TBody extends RequestBody = RequestBody> extends Omit<GMRequestDetails, 'data' | 'onload' | 'onerror' | 'ontimeout' | 'onabort'> {
  data?: TBody;
}

export interface RequestResult<T = unknown> {
  ok: boolean;
  status: number;
  statusText: string;
  data?: T;
  text?: string;
  response: GMResponse<T> | null;
  error?: unknown;
}

export function request<T = unknown, TBody extends RequestBody = RequestBody>(options: RequestOptions<TBody>): Promise<RequestResult<T>> {
  return new Promise((resolve) => {
    const finish = (response: GMResponse<T> | null, error?: unknown): void => {
      const status = response?.status ?? 0;
      const statusText = response?.statusText ?? (error ? 'Error' : '');
      let responseData = response?.response;
      if (options.responseType === 'json') {
        if (typeof responseData !== 'object' && response?.responseText) {
          try {
            responseData = JSON.parse(response.responseText)
          } catch (_e) {
            //
          }
        }
      }
      resolve({
        ok: status >= 200 && status < 300,
        status,
        statusText,
        data: responseData,
        text: response?.responseText,
        response,
        error
      });
    };

    try {
      GM_xmlhttpRequest<T>({
        timeout: 30000,
        ...options,
        onload: (response) => finish(response),
        onerror: (response) => finish(response, response),
        ontimeout: (response) => finish(response, new Error('Request timed out')),
        onabort: (response) => finish(response, new Error('Request aborted'))
      });
    } catch (error) {
      finish(null, error);
    }
  });
}
