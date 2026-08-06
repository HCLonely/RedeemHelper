import { updateOrShowModal } from '../../shared/ui';
import type { ItchLogLevel, ItchReporter } from './types';

const ICON_BY_LEVEL: Record<ItchLogLevel, SwalIcon> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error'
};

export function reportItch(
  reporter: ItchReporter | undefined,
  message: string,
  level: ItchLogLevel = 'info',
  details?: string
): void {
  if (reporter) {
    reporter({ timestamp: Date.now(), level, message, details });
    return;
  }

  updateOrShowModal({
    title: message,
    text: details,
    icon: ICON_BY_LEVEL[level],
    className: 'break-all'
  });
  console.log(details ? `${message}\n${details}` : message);
}
