module.exports = {
  apps: [
    {
      name: 'qrsign',
      script: './server.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production'
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      time: true
    }
  ]
};
