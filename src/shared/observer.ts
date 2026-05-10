export function mountObserver(callback: () => void): MutationObserver {
  const observer = new MutationObserver(callback);

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  callback();

  return observer;
}
