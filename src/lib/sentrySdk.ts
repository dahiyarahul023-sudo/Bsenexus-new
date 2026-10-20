// Export only the runtime APIs we use so a dynamic SDK import stays tree-shakeable.
export { init, setUser, captureException } from '@sentry/react';
