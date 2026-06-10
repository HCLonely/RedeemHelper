import { request } from '../../shared/http';
import { mountObserver } from '../../shared/observer';
import { showModal, updateOrShowModal } from '../../shared/ui';

const GOG_BUTTON_CLASS = 'gog-claim-button';
const GOG_PROCESSED_CLASS = 'gog-claimed';
const GOG_CSS = `
.rh-claim-button{
  display:inline-flex;align-items:center;gap:0.25em;
  padding:0.15em 0.7em;
  background:linear-gradient(135deg,#22c55e 0%,#16a34a 100%);
  color:#ffffff !important;
  font-weight:600;font-size:0.85em;line-height:1.35;
  border:none;border-radius:0.35em;
  cursor:pointer;text-decoration:none !important;
  box-shadow:0 1px 3px rgba(22,163,74,0.35);
  transition:all 0.2s ease;
  vertical-align:middle;
  white-space:nowrap;
  margin-left:0.5em;
}
.rh-claim-button:hover{
  background:linear-gradient(135deg,#16a34a 0%,#15803d 100%);
  box-shadow:0 2px 8px rgba(22,163,74,0.45);
  transform:translateY(-1px);
  color:#ffffff !important;text-decoration:none !important;
}
.rh-claim-button:active{
  transform:translateY(0);
  box-shadow:0 1px 2px rgba(22,163,74,0.2);
}
`;

let initialized = false;
let observer: MutationObserver | null = null;

interface GOGClaimResponse {
  message?: string;
}

function isEligibleGOGLink(href: string): boolean {
  try {
    const url = new URL(href);
    return url.hostname === 'www.gog.com' && url.pathname === '/giveaway/claim';
  } catch {
    return false;
  }
}

function addButtons(): void {
  for (const link of Array.from(document.querySelectorAll<HTMLAnchorElement>(`a[href*="gog.com/giveaway/claim"]:not(.${GOG_PROCESSED_CLASS})`))) {
    link.classList.add(GOG_PROCESSED_CLASS);
    const href = link.href;
    if (!isEligibleGOGLink(href)) continue;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `rh-claim-button ${GOG_BUTTON_CLASS}`;
    button.textContent = '领取';
    button.addEventListener('click', () => {
      void claimGOGGiveaway('https://www.gog.com/giveaway/claim');
    });

    link.after(button);
  }
}

function collectBatchLinks(): string[] {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(`a.${GOG_BUTTON_CLASS}`))
    .map((button) => button.previousElementSibling as HTMLAnchorElement | null)
    .filter((sibling): sibling is HTMLAnchorElement => sibling !== null && sibling.tagName === 'A')
    .map((link) => link.href);

  return [...new Set(links)];
}

async function claimGOGGiveaway(url: string): Promise<boolean> {
  void showModal({
    title: '正在领取GOG...',
    text: '',
    icon: 'info'
  });

  const response = await request<GOGClaimResponse, string>({
    url,
    method: 'POST',
    data: '{}',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    responseType: 'json'
  });

  if (response.status === 201
    || (response.status === 409 && response.data?.message === 'Already claimed')) {
    updateOrShowModal({
      title: '领取成功！',
      text: '',
      icon: 'success'
    });
    return true;
  }

  updateOrShowModal({
    title: '领取失败！',
    text: response.data?.message || `状态码: ${response.status}`,
    icon: 'error'
  });
  return false;
}

export function initGOG(): void {
  if (initialized) return;
  initialized = true;

  GM_addStyle(GOG_CSS);
  observer = mountObserver(addButtons);
}

// export async function runGOGBatch(): Promise<void> {
//   addButtons();
//   const links = collectBatchLinks();
//   const failedLinks: string[] = [];

//   for (const link of links) {
//     const ok = await claimGOGGiveaway(link);
//     if (!ok) {
//       failedLinks.push(link);
//     }
//   }

//   if (failedLinks.length === 0) {
//     void showModal({
//       title: '全部领取完成！',
//       icon: 'success'
//     });
//     return;
//   }

//   void showModal({
//     title: '以下任务未完成！',
//     icon: 'warning',
//     text: failedLinks.join('\n')
//   });
// }

export function getGOGObserver(): MutationObserver | null {
  return observer;
}
