module.exports = {
  apps: [{
    name: 'e-man',
    script: './server.js'
  }],
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'ec2-35-174-111-99.compute-1.amazonaws.com',
      key: '~/.ssh/ensc-menrva-19.pem',
      ref: 'origin/master',
      repo: 'git@github.com:bretthannigan/e-man.git',
      path: '/home/ubuntu/e-man',
      'post-deploy': 'npm install && pm2 startOrRestart ecosystem.config.js'
    }
  }
}