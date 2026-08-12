module.exports = {
  apps: [
    {
      name: 'pc-mgmt:7100',
      script: './dist/server/entry.mjs',
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
