// pm2 start worker/ecosystem.config.cjs
// pm2 save && pm2 startup   (sekali saja, supaya keduanya otomatis jalan lagi setelah reboot VPS)
module.exports = {
  apps: [
    {
      name: 'tank-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: __dirname + '/..',
      env_file: '.env',
      autorestart: true,
      max_memory_restart: '400M',
      out_file: 'logs/tank-web.out.log',
      error_file: 'logs/tank-web.error.log',
      time: true,
    },
    {
      name: 'tank-alert-worker',
      script: 'node_modules/.bin/tsx',
      args: 'worker/index.ts',
      cwd: __dirname + '/..',
      env_file: '.env',
      autorestart: true,
      max_restarts: 50,
      restart_delay: 5000,
      exp_backoff_restart_delay: 2000,
      max_memory_restart: '250M',
      out_file: 'logs/tank-alert-worker.out.log',
      error_file: 'logs/tank-alert-worker.error.log',
      time: true,
    },
  ],
};
