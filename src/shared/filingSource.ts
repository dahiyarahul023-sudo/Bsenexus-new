/** Filing intake/feed/delivery policy. NSE prices and meeting schedules are unrelated. */
export function isBseFiling(item: any): boolean {
  const id = String(item?.NEWSID || item?.newsId || item?.id || '');
  const source = String(item?._source || item?.source || '');
  const url = String(item?.pdfLink || item?.attachmentUrl || item?.ATTACHMENTNAME || '');
  return !/^(?:corp_)?nse_/i.test(id) && !/^NSE(?:_|\b)/i.test(source)
    && !/^https?:\/\/(?:nsearchives|archives|www)\.nseindia\.com(?:\/|$)/i.test(url);
}
