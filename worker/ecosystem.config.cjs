// pm2 start worker/ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'tank-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      env_file: '.env',
      autorestart: true,
    },
    {
      name: 'tank-alert-worker',
      script: 'node_modules/.bin/tsx',
      args: 'worker/index.ts',
      env_file: '.env',
      autorestart: true,
      max_restarts: 50,
      restart_delay: 5000,
    },
  ],
};
