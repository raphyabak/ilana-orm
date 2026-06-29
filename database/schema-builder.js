const Database = require('./connection');

class SchemaBuilder {
  constructor(connection) {
    this.knex = Database.connection(connection);
    this.currentTable = '';
  }

  createTable(tableName, callback) {
    return this.knex.schema.createTable(tableName, callback);
  }

  dropTable(tableName) {
    return this.knex.schema.dropTable(tableName);
  }

  dropTableIfExists(tableName) {
    return this.knex.schema.dropTableIfExists(tableName);
  }

  renameTable(from, to) {
    return this.knex.schema.renameTable(from, to);
  }

  hasTable(tableName) {
    return this.knex.schema.hasTable(tableName);
  }

  hasColumn(tableName, columnName) {
    return this.knex.schema.hasColumn(tableName, columnName);
  }

  table(tableName, callback) {
    return this.knex.schema.table(tableName, callback);
  }

  alterTable(tableName, callback) {
    return this.knex.schema.alterTable(tableName, callback);
  }

  raw(statement) {
    return this.knex.raw(statement);
  }

  // PostgreSQL specific
  createSchema(schemaName) {
    return this.knex.schema.createSchema(schemaName);
  }

  dropSchema(schemaName) {
    return this.knex.schema.dropSchema(schemaName);
  }

  // Advanced column types
  jsonb(columnName) {
    if (this.knex.client.config.client === 'pg') {
      return this.knex.schema.jsonb ? this.knex.schema.jsonb(columnName) : this.knex.schema.json(columnName);
    }
    return this.knex.schema.json(columnName);
  }

  geometry(columnName, geometryType) {
    return this.knex.schema.specificType(columnName, geometryType || 'geometry');
  }

  point(columnName) {
    return this.knex.schema.specificType(columnName, 'point');
  }

  lineString(columnName) {
    return this.knex.schema.specificType(columnName, 'linestring');
  }

  polygon(columnName) {
    return this.knex.schema.specificType(columnName, 'polygon');
  }

  inet(columnName) {
    return this.knex.schema.specificType(columnName, 'inet');
  }

  macaddr(columnName) {
    return this.knex.schema.specificType(columnName, 'macaddr');
  }

  specificType(columnName, type) {
    return this.knex.schema.specificType(columnName, type);
  }

  // Enhanced column modifiers with database-specific implementations
  after(columnName) {
    if (this.knex.client.config.client === 'mysql2') {
      return this.knex.schema.raw(`AFTER ${columnName}`);
    }
    return this;
  }

  first() {
    if (this.knex.client.config.client === 'mysql2') {
      return this.knex.schema.raw('FIRST');
    }
    return this;
  }

  checkPositive(column) {
    const client = this.knex.client.config.client;
    if (client === 'pg' || client === 'mysql2') {
      return this.knex.raw(`ALTER TABLE ?? ADD CONSTRAINT ?? CHECK (?? > 0)`,
        [this.currentTable, `${column}_positive`, column]);
    }
    return Promise.resolve();
  }

  checkRegex(column, pattern) {
    const client = this.knex.client.config.client;
    if (client === 'pg') {
      return this.knex.raw(`ALTER TABLE ?? ADD CONSTRAINT ?? CHECK (?? ~ ?)`,
        [this.currentTable, `${column}_regex`, column, pattern]);
    } else if (client === 'mysql2') {
      return this.knex.raw(`ALTER TABLE ?? ADD CONSTRAINT ?? CHECK (?? REGEXP ?)`,
        [this.currentTable, `${column}_regex`, column, pattern]);
    }
    return Promise.resolve();
  }

  generatedAs(column, expression) {
    const client = this.knex.client.config.client;
    if (client === 'mysql2') {
      return this.knex.raw(`ALTER TABLE ?? ADD ?? VARCHAR(255) GENERATED ALWAYS AS (${expression}) STORED`,
        [this.currentTable, column]);
    } else if (client === 'pg') {
      return this.knex.raw(`ALTER TABLE ?? ADD ?? TEXT GENERATED ALWAYS AS (${expression}) STORED`,
        [this.currentTable, column]);
    }
    return Promise.resolve();
  }

  collate(tableName, collation) {
    const client = this.knex.client.config.client;
    if (client === 'mysql2') {
      return this.knex.raw(`ALTER TABLE ?? COLLATE ??`, [tableName, collation]);
    } else if (client === 'pg') {
      return this.knex.raw(`ALTER TABLE ?? ALTER COLUMN name TYPE TEXT COLLATE ??`, [tableName, collation]);
    }
    return Promise.resolve();
  }

  // Enhanced PostgreSQL types
  array(columnName, type = 'text') {
    if (this.knex.client.config.client === 'pg') {
      return this.knex.schema.specificType(columnName, `${type}[]`);
    }
    return this.knex.schema.json(columnName);
  }

  numrange(columnName) {
    return this.knex.schema.specificType(columnName, 'numrange');
  }

  daterange(columnName) {
    return this.knex.schema.specificType(columnName, 'daterange');
  }

  tsvector(columnName) {
    return this.knex.schema.specificType(columnName, 'tsvector');
  }

  // Enhanced MySQL types
  fulltext(columns, indexName) {
    if (this.knex.client.config.client === 'mysql2') {
      const name = indexName || `${columns.join('_')}_fulltext`;
      const colRefs = columns.map(() => '??').join(', ');
      return this.knex.raw(`ALTER TABLE ?? ADD FULLTEXT INDEX ?? (${colRefs})`,
        [this.currentTable, name, ...columns]);
    }
    return Promise.resolve();
  }

  spatial(column, indexName) {
    if (this.knex.client.config.client === 'mysql2') {
      const name = indexName || `${column}_spatial`;
      return this.knex.raw(`ALTER TABLE ?? ADD SPATIAL INDEX ?? (??)`,
        [this.currentTable, name, column]);
    }
    return Promise.resolve();
  }

  setCurrentTable(tableName) {
    this.currentTable = tableName;
    return this;
  }

  // Enhanced utility methods
  get client() {
    return this.knex.client;
  }

  get fn() {
    return this.knex.fn;
  }

  // Database-specific utilities
  enableExtension(name) {
    if (this.knex.client.config.client === 'pg') {
      return this.knex.raw(`CREATE EXTENSION IF NOT EXISTS "${name}"`);
    }
    return Promise.resolve();
  }

  createEnum(name, values) {
    if (this.knex.client.config.client === 'pg') {
      return this.knex.raw(`CREATE TYPE ${name} AS ENUM (${values.map(v => `'${v}'`).join(', ')})`);
    }
    return Promise.resolve();
  }

  dropEnum(name) {
    if (this.knex.client.config.client === 'pg') {
      return this.knex.raw(`DROP TYPE IF EXISTS ${name}`);
    }
    return Promise.resolve();
  }
}

module.exports = SchemaBuilder;