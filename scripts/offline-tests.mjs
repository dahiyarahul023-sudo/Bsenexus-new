import net from 'node:net';

// Routine tests may use loopback servers or replace fetch with explicit fixtures.
// An omitted mock must fail before DNS/TCP or an HTTP payload can leave the host.
const local = host => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
const blocked = () => Object.assign(new Error('External network disabled in routine tests; use a local fixture'), {
  code: 'ERR_TEST_NETWORK_DISABLED',
});
const fetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!local(url.hostname)) throw blocked();
  return fetch(input, init);
};

const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const options = first && typeof first === 'object' ? first : {};
  const unix = (typeof first === 'string' && !/^\d+$/.test(first)) || options.path;
  const host = String(options.host || (typeof args[1] === 'string' ? args[1] : 'localhost'));
  if (!unix && !local(host)) throw blocked();
  return connect.apply(this, args);
};
