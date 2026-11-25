const baseEnv = {
  'NODE_ENV': 'development',
  'HOST': '0.0.0.0',
  'PORT': '4242',
  'API_BASE': '/api/v1',
  'API_URL': 'http://localhost:4242/api/v1',
  'BASE_URL': 'http://localhost:4242/api/v1',
  'ADMIN_URL': 'http://localhost:4242/api/v',
  'UPLOADS_DIR': '/Web_Data/Uploads/',

  'DEFAULT_TIMEZONE': 'Africa/Addis_Ababa',
  'JWT_SECRET': 'p[V(<8^sp,$vyZ3kwKbu>9_#K',

  'DB_HOST': 'localhost',
  'DB_PORT': '27017',
  'DB_AUTH': 'false',
  'DB_USER': '',
  'DB_PASS': '',
  'DB_NAME': '',

  'SMS_PROVIDER_HOST': '',
  'SMS_PROVIDER_PORT': '',
  'SMS_PROVIDER_USER': '',
  'SMS_PROVIDER_PASS': '',

}

const baseEnvClone = Object.assign({}, baseEnv)
const prodEnv = Object.assign(baseEnvClone, {
  'NODE_ENV': 'production',
  'HOST': '0.0.0.0',
  'PORT': '8081',
  'API_BASE': '/api/v1',
  'API_URL': 'http://localhost:4242/api/v',
  'ADMIN_URL': 'http://localhost:4242/api/v',
  'UPLOADS_DIR': '/Web_Data/Uploads/',

  'DEFAULT_TIMEZONE': 'Africa/Addis_Ababa',
  'MYSQL_HOST': 'localhost',
  'MYSQL_PORT': '3306',
  'MYSQL_AUTH': 'false',
  'MYSQL_USER': '',
  'MYSQL_PASS': '',
  'MYSQL_NAME': ''
})

module.exports = {
  apps: [{
    name: 'pm-api',
    script: './dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
    },
    env_production: {
      NODE_ENV: 'production',
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
}
