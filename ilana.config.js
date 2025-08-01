const Database = require('ilana/database/connection').default;

const config = {
  default: 'sqlite',
  
  connections: {
    sqlite: {
      client: 'sqlite3',
      connection: {
        filename: './database.sqlite'
      }
    },
    
    // mysql: {
    //   client: 'mysql2',
    //   connection: {
    //     host: 'localhost',
    //     port: 3306,
    //     user: 'your_username',
    //     password: 'your_password',
    //     database: 'your_database'
    //   }
    // },
    
    // postgres: {
    //   client: 'pg',
    //   connection: {
    //     host: 'localhost',
    //     port: 5432,
    //     user: 'your_username',
    //     password: 'your_password',
    //     database: 'your_database'
    //   }
    // },
    
    // mysql_secondary: {
    //   client: 'mysql2',
    //   connection: {
    //     host: 'secondary.mysql.com',
    //     port: 3306,
    //     user: 'secondary_user',
    //     password: 'secondary_password',
    //     database: 'secondary_db'
    //   }
    // }
  },
  
  migrations: {
    directory: './migrations',
    tableName: 'migrations'
  },
  
  seeds: {
    directory: './seeds'
  }
};

// Auto-initialize database connections
Database.configure(config);

module.exports = config;