import { request } from '../../shared/http';
import { showModal, updateOrShowModal } from '../../shared/ui';

interface IndieGalaAddResponse {
  status?: 'ok' | 'added' | 'login' | 'auth' | string;
}

function updateModal(options: SwalOptions): void {
  updateOrShowModal(options);
}

function parseAddToLibraryRequest(pageHtml: string, href: string): { url: string; csrfToken: string } | null {
  const pageId = pageHtml.match(/dataToSend\.(gala_page_)?id[\s]*?=[\s]*?'(.*?)';/)?.[2];
  if (!pageId) return null;

  const csrfToken = pageHtml.match(/<input name="csrfmiddlewaretoken".+?value="(.+?)"/)?.[1];
  if (!csrfToken) return null;

  const targetUrl = new URL(href);
  const gameSlug = targetUrl.pathname.replace(/\//g, '');
  const subdomain = targetUrl.hostname.replace('.indiegala.com', '');
  const url = new URL(`/developers/ajax/add-to-library/${pageId}/${gameSlug}/${subdomain}`, targetUrl).href;

  return { url, csrfToken };
}

function syncOwnedIndieGalaLinks(): void {
  const syncIgLib = (window as Window & typeof globalThis & { syncIgLib?: (force?: boolean, notify?: boolean) => Promise<string[]> }).syncIgLib;
  if (typeof syncIgLib !== 'function') return;

  void syncIgLib(false, false).then((allGames) => {
    for (const link of Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*=".indiegala.com/"]'))) {
      link.classList.add('ig-checked');
      try {
        const href = link.href;
        const url = new URL(href);
        if (/^https?:\/\/[\w\d]+?\.indiegala\.com\/.+$/.test(href) && allGames.includes(url.pathname.replace(/\//g, ''))) {
          link.classList.add('ig-owned');
        }
      } catch (error) {
        console.error(error);
      }
    }
  });
}

async function promptLogin(): Promise<void> {
  const result = await showModal({
    title: '请先登录！',
    icon: 'error',
    showCancelButton: true,
    confirmButtonText: '登录',
    cancelButtonText: '关闭'
  } as SwalOptions);

  if (result) {
    window.open('https://www.indiegala.com/login', '_blank');
  }
}

export async function addToIndiegalaLibrary(target: string): Promise<boolean | null> {
  const href = target;

  void showModal({
    title: '正在获取入库链接...',
    text: href,
    icon: 'info'
  });

  const pageResponse = await request<string>({
    url: href,
    method: 'GET',
    anonymous: false,
    timeout: 30000
  });

  if (!pageResponse.text) {
    console.error(pageResponse);
    updateModal({
      title: '获取入库链接失败！',
      text: href,
      icon: 'error'
    });
    return null;
  }

  if (pageResponse.text.includes('loginRedirect')) {
    updateModal({
      title: '请先登录！',
      text: 'https://www.indiegala.com/login',
      icon: 'error'
    });
    return null;
  }

  const addRequest = parseAddToLibraryRequest(pageResponse.text, href);
  if (!addRequest) {
    console.error(pageResponse);
    updateModal({
      title: '获取入库Id失败！',
      text: href,
      icon: 'error'
    });
    return null;
  }

  updateModal({
    title: '正在入库...',
    text: href,
    icon: 'info'
  });

  const addResponse = await request<IndieGalaAddResponse>({
    url: addRequest.url,
    method: 'POST',
    responseType: 'json',
    nocache: true,
    headers: {
      'content-type': 'application/json',
      'X-CSRFToken': addRequest.csrfToken,
      'X-CSRF-Token': addRequest.csrfToken
    },
    timeout: 30000
  });

  if (addResponse.data?.status === 'ok') {
    updateModal({
      title: '入库成功！',
      text: href,
      icon: 'success'
    });
    syncOwnedIndieGalaLinks();
    return true;
  }

  if (addResponse.data?.status === 'added') {
    updateModal({
      title: '已在库中！',
      text: href,
      icon: 'warning'
    });
    return true;
  }

  if (addResponse.data?.status === 'login' || addResponse.data?.status === 'auth') {
    await promptLogin();
    return false;
  }

  console.error(addResponse);
  updateModal({
    title: '入库失败！',
    text: href,
    icon: 'error'
  });
  return null;
}
