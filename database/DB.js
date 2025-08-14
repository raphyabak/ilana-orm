const Database = require('./connection');

/**
 * Laravel-style DB facade for IlanaORM
 */
class DB {
  /**
   * Execute a database transaction with automatic retry for deadlocks
   * @param {Function} callback - Transaction callback function
   * @param {number} attempts - Number of retry attempts (default: 1)
   * @param {string} connection - Connection name (optional)
   * @returns {Promise<any>}
   */
  static async transaction(callback, attempts = 1, connection = null) {
    return Database.transaction(callback, attempts, connection);
  }

  /**
   * Begin a database transaction manually
   * @param {string} connection - Connection name (optional)
   * @returns {Promise<Transaction>}
   */
  static async beginTransaction(connection = null) {
    return Database.beginTransaction(connection);
  }

  /**
   * Commit a transaction
   * @param {Transaction} trx - Transaction object
   * @returns {Promise<void>}
   */
  static async commit(trx) {
    return Database.commit(trx);
  }

  /**
   * Rollback a transaction
   * @param {Transaction} trx - Transaction object
   * @returns {Promise<void>}
   */
  static async rollback(trx) {
    return Database.rollback(trx);
  }

  /**
   * Get a query builder for a table
   * @param {string} table - Table name
   * @param {string} connection - Connection name (optional)
   * @returns {QueryBuilder}
   */
  static table(table, connection = null) {
    return Database.table(table, connection);
  }

  /**
   * Execute a raw SQL query
   * @param {string} sql - SQL query
   * @param {Array} bindings - Query bindings
   * @param {string} connection - Connection name (optional)
   * @returns {Promise<any>}
   */
  static raw(sql, bindings = [], connection = null) {
    const db = connection ? Database.connection(connection) : Database.getInstance();
    return db.raw(sql, bindings);
  }

  /**
   * Get a database connection
   * @param {string} name - Connection name (optional)
   * @returns {Connection}
   */
  static connection(name = null) {
    return Database.connection(name);
  }

  /**
   * Get the default connection name
   * @returns {string}
   */
  static getDefaultConnection() {
    return Database.getDefaultConnection();
  }
}

module.exports = DB;