module.exports = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || 'reserve_me',
  user: process.env.DB_USER || 'reserve_me_user',
  password: process.env.DB_PASSWORD || 'reserve_me_password',
};
