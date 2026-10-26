/** Vite 6 still connects its CSS client when server.hmr is false.
 * Keep Vite's style/error helpers, but don't start a socket to a disabled server.
 * This compatibility seam is exercised against the installed Vite client in CI.
 */
export function disabledHmrClient() {
  let disabled = false;
  return {
    name: 'bsenexus-disabled-hmr-client',
    apply: /** @type {'serve'} */ ('serve'),
    enforce: /** @type {'post'} */ ('post'),
    configResolved(config) { disabled = config.server.hmr === false; },
    transform(code, id) {
      if (!disabled || !id.replaceAll('\\', '/').endsWith('/vite/dist/client/client.mjs')) return null;
      const connect = 'transport.connect(createHMRHandler(handleMessage));';
      if (code.split(connect).length !== 2) {
        throw new Error('Vite client changed: review the disabled-HMR connection adapter before running this preview.');
      }
      return { code: code.replace(connect, '// HMR is explicitly disabled; preserve CSS helpers without opening a socket.'), map: null };
    },
  };
}
