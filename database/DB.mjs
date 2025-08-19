import Database from './connection.mjs';

// DB facade - provides static methods for database operations
class DB {
  static connection(name) {
    return Database.connection(name);
  }

  static table(tableName, connection) {
    return Database.table(tableName, connection);
  }

  static raw(query, bindings, connection) {
    return Database.raw(query, bindings, connection);
  }

  static select(query, bindings, connection) {
    return Database.select(query, bindings, connection);
  }

  static insert(table, data, connection) {
    return Database.insert(table, data, connection);
  }

  static update(table, data, where, connection) {
    return Database.update(table, data, where, connection);
  }

  static delete(table, where, connection) {
    return Database.delete(table, where, connection);
  }

  static transaction(callback, connection) {
    return Database.transaction(callback, connection);
  }

  static beginTransaction(connection) {
    return Database.beginTransaction(connection);
  }

  static commit(trx) {
    return Database.commit(trx);
  }

  static rollback(trx) {
    return Database.rollback(trx);
  }

  static schema(connection) {
    return Database.schema(connection);
  }

  static migrate(connection) {
    return Database.migrate(connection);
  }

  static seed(connection) {
    return Database.seed(connection);
  }

  static destroy(connection) {
    return Database.destroy(connection);
  }

  static destroyAll() {
    return Database.destroyAll();
  }

  static configure(config) {
    return Database.configure(config);
  }

  static getInstance(connection) {
    return Database.getInstance(connection);
  }

  static getConfig() {
    return Database.getConfig();
  }

  static setConfig(config) {
    return Database.setConfig(config);
  }

  // Query builder methods
  static query(connection) {
    return Database.getInstance(connection);
  }

  static from(table, connection) {
    return Database.table(table, connection);
  }

  // Aggregation methods
  static count(table, column = '*', connection) {
    return Database.table(table, connection).count(column);
  }

  static sum(table, column, connection) {
    return Database.table(table, connection).sum(column);
  }

  static avg(table, column, connection) {
    return Database.table(table, connection).avg(column);
  }

  static min(table, column, connection) {
    return Database.table(table, connection).min(column);
  }

  static max(table, column, connection) {
    return Database.table(table, connection).max(column);
  }

  // Utility methods
  static listen(event, callback) {
    return Database.listen(event, callback);
  }

  static unlisten(event, callback) {
    return Database.unlisten(event, callback);
  }

  static enableQueryLog() {
    return Database.enableQueryLog();
  }

  static disableQueryLog() {
    return Database.disableQueryLog();
  }

  static getQueryLog() {
    return Database.getQueryLog();
  }

  static flushQueryLog() {
    return Database.flushQueryLog();
  }

  static pretend(callback, connection) {
    return Database.pretend(callback, connection);
  }

  static reconnect(connection) {
    return Database.reconnect(connection);
  }

  static disconnect(connection) {
    return Database.disconnect(connection);
  }

  static getConnectionName() {
    return Database.getConnectionName();
  }

  static setConnectionName(name) {
    return Database.setConnectionName(name);
  }

  static getTablePrefix(connection) {
    return Database.getTablePrefix(connection);
  }

  static setTablePrefix(prefix, connection) {
    return Database.setTablePrefix(prefix, connection);
  }
}

export default DB;