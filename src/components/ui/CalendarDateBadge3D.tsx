import React from 'react';
import '../../styles/calendar-material.css';

interface CalendarDateBadge3DProps {
  month: string;
  date: string;
  day?: string;
  className?: string;
  size?: 'icon' | 'sm' | 'md' | 'lg';
}

/** One red backplate and frosted face for real dates and decorative icons. */
export function CalendarDateBadge3D({ month, date, day, className = '', size = 'md' }: CalendarDateBadge3DProps) {
  return <span role="img" aria-label={`${month} ${date}${day ? `, ${day}` : ''}`} className={`calendar-material calendar-material-${size} ${className}`}>
    <span className="calendar-material-pins" aria-hidden="true"><i /><i /></span>
    <span className="calendar-material-face" aria-hidden="true">
      <span className="calendar-material-month">{month.slice(0, 3)}</span>
      <span className="calendar-material-date">{date}</span>
      {day && <span className="calendar-material-day">{day.slice(0, 3)}</span>}
    </span>
  </span>;
}
