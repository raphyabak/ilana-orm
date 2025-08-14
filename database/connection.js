const knex = require('knex');

class Database {
  static connections = new Map();
  static _currentTransaction = null;

  static configure(config) {
    this.config = config;
    this.defaultConnection = config.default;
    
    // Initialize all configured connections
    for (const [name, connConfig] of Object.entries(config.connections)) {
      const connection = knex({
        ...connConfig,
        migrations: config.migrations || {
          directory: './migrations',
          tableName: 'migrations'
        },
        seeds: config.seeds || {
          directory: './seeds'
        }
      });
      this.connections.set(name, connection);
    }
    
    // Set default instance after all connections are created
    if (this.connections.has(this.defaultConnection)) {
      this.instance = this.connections.get(this.defaultConnection);
    }
    
    if (!this.instance) {
      throw new Error(`Default connection '${this.defaultConnection}' not found in connections config.`);
    }
  }

  static connection(name) {
    if (!name) return this.getInstance();
    const conn = this.connections.get(name);
    if (!conn) {
      throw new Error(`Database connection '${name}' not configured.`);
    }
    return conn;
  }

  static getDefaultConnection() {
    return this.defaultConnection;
  }

  static hasConnection(name) {
    return this.connections.has(name);
  }

  static getInstance() {
    if (!this.instance) {
      throw new Error('Database not configured. Call Database.configure() first.');
    }
    return this.instance;
  }

  static async transaction(callback, attempts = 1, connection) {
    const db = this.connection(connection);
    
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await db.transaction(async (trx) => {
          // Set current transaction for models to use
          this._currentTransaction = trx;
          try {
            const result = await callback(trx);
            return result;
          } finally {
            this._currentTransaction = null;
          }
        });
      } catch (error) {
        if (attempt === attempts) throw error;
        // Wait before retry for deadlock scenarios
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      }
    }
  }

  static async beginTransaction(connection) {
    const db = this.connection(connection);
    const trx = await db.transaction();
    return {
      ...trx,
      commit: () => trx.commit(),
      rollback: () => trx.rollback()
    };
  }

  static commit(trx) {
    return trx.commit();
  }

  static rollback(trx) {
    return trx.rollback();
  }

  static getCurrentTransaction() {
    return this._currentTransaction;
  }

  static table(tableName, connectionName) {
    return this.connection(connectionName)(tableName);
  }

  static raw(sql, bindings) {
    return this.getInstance().raw(sql, bindings);
  }
}

module.exports = Database;