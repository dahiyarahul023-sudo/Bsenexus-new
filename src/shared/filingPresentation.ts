import { formatFullDateTime, parseFilingTimestamp } from '../utils/timeFormat';

export function publicFilingPresentation(filing: {
  category?: unknown;
  bseTimestamp?: number | string;
  bseTime?: string;
}) {
  const label = String(filing.category || 'Corporate announcement').replace(/[_-]+/g, ' ').toLowerCase();
  const timestamp = parseFilingTimestamp(filing.bseTimestamp) || parseFilingTimestamp(filing.bseTime);
  const iso = timestamp > 0 ? new Date(timestamp).toISOString() : '';
  return {
    category: label.charAt(0).toUpperCase() + label.slice(1),
    iso,
    date: iso ? formatFullDateTime(iso) : '',
  };
}
