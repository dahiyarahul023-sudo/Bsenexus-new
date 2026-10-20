export function parseMeetingDateTile(dateStr?: string): { day: string; month: string } {
  if (!dateStr) return { day: '24', month: 'BSE' };
  const clean = dateStr.trim();
  
  // Format with space, hyphen, slash, or dot
  const parts = clean.split(/[\s\-_/.]+/);
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  
  if (parts.length >= 2) {
    // DD-MMM-YYYY or DD MMM YYYY (e.g., "14-Aug-2026", "14 Aug 2026", "14-08-2026")
    if (/^\d{1,2}$/.test(parts[0])) {
      const day = parts[0].padStart(2, '0');
      const m = parts[1];
      if (/^[a-zA-Z]+$/.test(m)) {
        return { day, month: m.substring(0, 3).toUpperCase() };
      }
      const monthIdx = parseInt(m, 10) - 1;
      if (monthIdx >= 0 && monthIdx < 12) {
        return { day, month: monthNames[monthIdx] };
      }
      return { day, month: m.substring(0, 3).toUpperCase() };
    }
    // YYYY-MM-DD (e.g. "2026-08-14")
    if (/^\d{4}$/.test(parts[0]) && parts[2] && /^\d{1,2}$/.test(parts[2])) {
      const day = parts[2].padStart(2, '0');
      const m = parts[1];
      const monthIdx = parseInt(m, 10) - 1;
      if (monthIdx >= 0 && monthIdx < 12) {
        return { day, month: monthNames[monthIdx] };
      }
      return { day, month: m.substring(0, 3).toUpperCase() };
    }
  }

  // Fallback using standard Date
  try {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
      return { day, month };
    }
  } catch {}

  const dayMatch = clean.match(/\b\d{1,2}\b/);
  const monthMatch = clean.match(/[a-zA-Z]{3,}/);
  return {
    day: dayMatch ? dayMatch[0].padStart(2, '0') : clean.slice(0, 2),
    month: monthMatch ? monthMatch[0].slice(0, 3).toUpperCase() : 'BSE'
  };
}
