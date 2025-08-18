// ilana.config.mjs - ES Module config example
export default {
  default: "sqlite",

  connections: {
    sqlite: {
      client: "sqlite3",
      connection: {
        filename: "./database.sqlite",
      },
    },

    mysql: {
      client: "mysql2",
      connection: {
        host: "localhost",
        port: 3306,
        user: "your_username",
        password: "your_password",
        database: "your_database",
      },
    },

    postgres: {
      client: "pg",
      connection: {
        host: "localhost",
        port: 5432,
        user: "your_username",
        password: "your_password",
        database: "your_database",
      },
    },
  },

  migrations: {
    directory: "./migrations",
    tableName: "migrations",
  },

  seeds: {
    directory: "./seeds",
  },
};