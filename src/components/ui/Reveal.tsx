import type { ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';
import * as motion from 'framer-motion/m';

/**
 * Reveal — scroll-triggered entrance: fades in while scaling up
 * (chota → bada) with a soft rise. Applied to section headers down
 * the landing page.
 */
export default function Reveal({
  children,
  className = '',
  delay = 0,
  y = 28,
  scale = 0.94,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  scale?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y, scale }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-70px' }}
      transition={{ duration: reduced ? 0 : 0.7, delay: reduced ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
