module.exports = {
  apps: [
    {
      name: 'jhd26-registrasi-absensi',
      script: 'src/app.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
