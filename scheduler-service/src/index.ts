import { createApp } from './app.js';

const { app, config } = createApp();

app.listen(config.port, () => {
  console.log(`Deal Cannon scheduler service listening on port ${config.port}.`);
});
