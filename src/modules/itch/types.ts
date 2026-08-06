export type ItchLogLevel = 'info' | 'success' | 'warning' | 'error';

export interface ItchLogEvent {
  timestamp: number;
  level: ItchLogLevel;
  message: string;
  details?: string;
}

export type ItchReporter = (event: ItchLogEvent) => void;

export type ItchRedeemStatus =
  | 'claimed'
  | 'owned'
  | 'expired'
  | 'login-required'
  | 'failed'
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
  unknown: number;
}
