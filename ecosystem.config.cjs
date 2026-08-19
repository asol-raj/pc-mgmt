module.exports = {
  apps: [
    {
      name: 'pc-mgmt:7100',
      // server.mjs runs pending migrations first, then starts ./dist/server/entry.mjs
      script: './server.mjs',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: 7100,
      },
    },
  ],
};
