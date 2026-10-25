import React from 'react';

/** Retained, hidden screens keep their state without adding another document H1. */
export function PageHeading({ active = true, ...props }: React.HTMLAttributes<HTMLHeadingElement> & { active?: boolean }) {
  const Tag = active ? 'h1' : 'h2';
  return <Tag {...props} />;
}
