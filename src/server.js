import { createSite } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = await createSite(config);
const server = app.listen(config.port, () => console.log(`${app.locals.theme.name} website (theme: ${config.theme}) listening on port ${config.port}`));

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => {
      app.locals.db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
