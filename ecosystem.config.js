module.exports = {
  apps: [{
    name: 'e-man',
    script: './server.js'
  }],
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'ec2-54-191-135-95.us-west-2.compute.amazonaws.com',
      key: '/Users/brett/.ssh/BrettsMacPro.pem',
      ref: 'origin/master',
      repo: 'git@github.com:bretthannigan/e-man.git',
      path: '/home/ubuntu/e-man',
      'pre-deploy-local': 'scp -i /Users/brett/.ssh/BrettsMacPro.pem .env ubuntu@ec2-54-191-135-95.us-west-2.compute.amazonaws.com:/home/ubuntu/.env',
      'pre-deploy': 'git reset --hard',
      'post-deploy': 'npm install && cp ~/.env .env && pm2 startOrRestart ecosystem.config.js'
    }
  }
}