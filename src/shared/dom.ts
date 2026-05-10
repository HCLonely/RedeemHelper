export function currentUrl(): URL {
  return new URL(window.location.href);
}

export function isHost(host: string | string[]): boolean {
  const hosts = Array.isArray(host) ? host : [host];
  const currentHost = window.location.hostname;

  return hosts.some((candidate) => currentHost === candidate || currentHost.endsWith(`.${candidate}`));
}
