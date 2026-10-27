import type { Server } from 'node:http';

export function resolveServerPort(rawPort = process.env.PORT, argv = process.argv): number {
  if (Array.isArray(argv)) {
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === '--port' && argv[i + 1]) {
        rawPort = argv[i + 1];
        i++;
        continue;
      }
      if (argv[i].startsWith('--port=')) {
        rawPort = argv[i].slice('--port='.length);
      }
    }
  }
  if (rawPort === undefined || rawPort.trim() === '') return 3000;
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort.trim()) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return port;
}

export function listenForStartup(server: Server, port: number, host = '0.0.0.0'): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException) => {
      server.removeListener('listening', onListening);
      if (error.code === 'EADDRINUSE') {
        error.message = `Port ${port} is already in use. Stop the existing app process or set PORT to a free port.`;
      }
      reject(error);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    try {
      server.listen(port, host);
    } catch (error) {
      server.removeListener('error', onError);
      server.removeListener('listening', onListening);
      reject(error);
    }
  });
}
