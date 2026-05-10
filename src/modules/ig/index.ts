import { isHost } from '../../shared/dom';
import { mountObserver } from '../../shared/observer';
import { showModal } from '../../shared/ui';
import { addToIndiegalaLibrary } from './addToLib';

const IG_BUTTON_CLASS = 'add-to-library';
const IG_PROCESSED_CLASS = 'ig-add2lib';
const IG_CSS = `.${IG_BUTTON_CLASS}{margin-left:10px;}`;

let initialized = false;
let observer: MutationObserver | null = null;

function isEligibleIndieGalaLink(href: string): boolean {
  try {
    const url = new URL(href);
    return /^https?:$/.test(url.protocol)
      && /^.+?\.indiegala\.com$/.test(url.hostname)
      && !['/login', '/library'].includes(url.pathname)
      && url.pathname !== '/';
  } catch {
    return false;
  }
}

function addButtons(): void {
  for (const link of Array.from(document.querySelectorAll<HTMLAnchorElement>(`a[href*=".indiegala.com/"]:not(.${IG_PROCESSED_CLASS})`))) {
    link.classList.add(IG_PROCESSED_CLASS);
    const href = link.href;
    if (!isEligibleIndieGalaLink(href)) continue;

    const button = document.createElement('a');
    button.className = IG_BUTTON_CLASS;
    button.href = 'javascript:void(0)';
    button.target = '_self';
    button.dataset.href = href;
    button.textContent = '入库';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      void addToIndiegalaLibrary(href);
    });

    link.after(button);
  }
}

function collectBatchLinks(): string[] {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(`a.${IG_BUTTON_CLASS}`))
    .filter((button) => !button.previousElementSibling?.classList.contains('ig-owned'))
    .map((button) => button.dataset.href || '')
    .filter(Boolean);

  return [...new Set(links)];
}

export function initIG(): void {
  if (initialized || isHost('indiegala.com')) return;
  initialized = true;

  GM_addStyle(IG_CSS);
  observer = mountObserver(addButtons);
}

export async function runIGBatch(): Promise<void> {
  if (isHost('indiegala.com')) return;

  addButtons();
  const links = collectBatchLinks();
  const failedLinks: string[] = [];

  for (const link of links) {
    const result = await addToIndiegalaLibrary(link);
    if (result === false) break;
    if (!result) {
      failedLinks.push(link);
    }
  }

  if (failedLinks.length === 0) {
    void showModal({
      title: '全部任务完成！',
      icon: 'success'
    });
    return;
  }

  void showModal({
    titleText: '以下任务未完成！',
    icon: 'warning',
    text: failedLinks.join('\n')
  });
}

export function getIGObserver(): MutationObserver | null {
  return observer;
}
