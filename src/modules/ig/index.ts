import { isHost } from '../../shared/dom';
import { exposeInlineAction, setInlineAction } from '../../shared/inlineAction';
import { mountObserver } from '../../shared/observer';
import { showModal } from '../../shared/ui';
import { addToIndiegalaLibrary } from './addToLib';

const IG_BUTTON_CLASS = 'add-to-library';
const IG_PROCESSED_CLASS = 'ig-add2lib';
const IG_CSS = `
.${IG_BUTTON_CLASS}{
  display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;height:inherit;align-self:stretch;
  margin-left:10px;padding:0 13px;border:1px solid rgba(5,150,105,.85);border-radius:8px;
  background:linear-gradient(135deg,#10b981 0%,#047857 100%);color:#fff !important;
  font:600 13px/1.35 system-ui,sans-serif;letter-spacing:.015em;cursor:pointer;
  box-shadow:0 2px 5px rgba(4,120,87,.28),inset 0 1px 0 rgba(255,255,255,.16);transition:transform .18s ease,box-shadow .18s ease,filter .18s ease;
}
.${IG_BUTTON_CLASS}:hover{color:#fff !important;filter:brightness(1.07) saturate(1.06);transform:translateY(-1px);box-shadow:0 5px 12px rgba(4,120,87,.34),inset 0 1px 0 rgba(255,255,255,.18);}
.${IG_BUTTON_CLASS}:active{transform:translateY(0);box-shadow:0 1px 3px rgba(4,120,87,.28);}
.${IG_BUTTON_CLASS}:focus-visible{outline:3px solid rgba(16,185,129,.55);outline-offset:2px;}
@media (prefers-reduced-motion:reduce){.${IG_BUTTON_CLASS}{transition:none;}}
`;

let initialized = false;
let observer: MutationObserver | null = null;
const addToLibraryAction = exposeInlineAction((element) => {
  void addToIndiegalaLibrary(element.dataset.targetUrl || '');
});

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

    const button = document.createElement('button');
    button.type = 'button';
    button.className = IG_BUTTON_CLASS;
    button.dataset.targetUrl = href;
    setInlineAction(button, addToLibraryAction);
    button.textContent = '入库';

    link.after(button);
  }
}

function collectBatchLinks(): string[] {
  const links = Array.from(document.querySelectorAll<HTMLButtonElement>(`button.${IG_BUTTON_CLASS}`))
    .filter((button) => !button.previousElementSibling?.classList.contains('ig-owned'))
    .map((button) => button.dataset.targetUrl || '')
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
