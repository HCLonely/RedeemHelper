export type ItchLogLevel = 'info' | 'success' | 'warning' | 'error';

export interface ItchLogEvent {
  timestamp: number;
  level: ItchLogLevel;
  message: string;
  details?: string;
}

export type ItchReporter = (event: ItchLogEvent) => void;

export interface ItchLinkage {
  connected: boolean;
  has(game: string): boolean | Promise<boolean>;
  get(...args: unknown[]): unknown | Promise<unknown>;
  add(...args: unknown[]): unknown | Promise<unknown>;
  update(): void | Promise<void>;
  removeOwned(games: string[]): string[] | Promise<string[]>;
}

export type ItchRedeemStatus =
  | 'claimed'
  | 'owned'
  | 'expired'
  | 'login-required'
  | 'failed'
  | 'cannot'
  | 'unknown';

export interface ItchRedeemResult {
  url: string;
  status: ItchRedeemStatus;
  message?: string;
}

export interface ItchBatchResult {
  total: number;
  claimed: number;
  owned: number;
  expired: number;
  loginRequired: number;
  failed: number;
  cannot: number;
  unknown: number;
}
