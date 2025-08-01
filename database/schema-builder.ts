import { Knex } from 'knex';
import Database from './connection';

export class SchemaBuilder {
  private knex: Knex;
  private currentTable: string = '';

  constructor(connection?: string) {
    this.knex = Database.connection(connection);
  }

  createTable(tableName: string, callback: (table: Knex.CreateTableBuilder) => void): Knex.SchemaBuilder {
    return this.knex.schema.createTable(tableName, callback);
  }

  dropTable(tableName: string): Knex.SchemaBuilder {
    return this.knex.schema.dropTable(tableName);
  }

  dropTableIfExists(tableName: string): Knex.SchemaBuilder {
    return this.knex.schema.dropTableIfExists(tableName);
  }

  renameTable(from: string, to: string): Knex.SchemaBuilder {
    return this.knex.schema.renameTable(from, to);
  }

  hasTable(tableName: string): Promise<boolean> {
    return this.knex.schema.hasTable(tableName);
  }

  hasColumn(tableName: string, columnName: string): Promise<boolean> {
    return this.knex.schema.hasColumn(tableName, columnName);
  }

  table(tableName: string, callback: (table: Knex.AlterTableBuilder) => void): Knex.SchemaBuilder {
    return this.knex.schema.table(tableName, callback);
  }

  alterTable(tableName: string, callback: (table: Knex.AlterTableBuilder) => void): Knex.SchemaBuilder {
    return this.knex.schema.alterTable(tableName, callback);
  }

  raw(statement: string): Knex.Raw {
    return this.knex.raw(statement);
  }

  // PostgreSQL specific
  createSchema(schemaName: string): Knex.SchemaBuilder {
    return this.knex.schema.createSchema(schemaName);
  }

  dropSchema(schemaName: string): Knex.SchemaBuilder {
    return this.knex.schema.dropSchema(schemaName);
  }

  // Advanced column types
  jsonb(columnName: string): any {
    if (this.knex.client.config.client === 'pg') {
      return this.knex.schema.jsonb ? this.knex.schema.jsonb(columnName) : this.knex.schema.json(columnName);
    }
    return this.knex.schema.json(columnName);
  }

  geometry(columnName: string, geometryType?: string): any {
    return this.knex.schema.specificType(columnName, geometryType || 'geometry');
  }

  point(columnName: string): any {
    return this.knex.schema.specificType(columnName, 'point');
  }

  lineString(columnName: string): any {
    return this.knex.schema.specificType(columnName, 'linestring');
  }

  polygon(columnName: string): any {
    return this.knex.schema.specificType(columnName, 'polygon');
  }

  inet(columnName: string): any {
    return this.knex.schema.specificType(columnName, 'inet');
  }

  macaddr(columnName: string): any {
    return this.knex.schema.specificType(columnName, 'macaddr');
  }

  specificType(columnName: string, type: string): any {
    return this.knex.schema.specificType(columnName, type);
  }

  // Enhanced column modifiers with database-specific implementations
  after(columnName: string): any {
    if (this.knex.client.config.client === 'mysql2') {
      return this.knex.schema.raw(`AFTER ${columnName}`);
    }
    return this;
  }

  first(): any {
    if (this.knex.client.config.client === 'mysql2') {
      return this.knex.schema.raw('FIRST');
    }
    return this;
  }

  checkPositive(column: string): Promise<any> {
    const client = this.knex.client.config.client;
    if (client === 'pg') {
      return this.knex.raw(`ALTER TABLE ${this.currentTable} ADD CONSTRAINT ${column}_positive CHECK (${column} > 0)`);
    } else if (client === 'mysql2') {
      return this.knex.raw(`ALTER TABLE ${this.currentTable} ADD CONSTRAINT ${column}_positive CHECK (${column} > 0)`);
    }
    return Promise.resolve();
  }

  checkRegex(column: string, pattern: string): Promise<any> {
    const client = this.knex.client.config.client;
    if (client === 'pg') {
      return this.knex.raw(`ALTER TABLE ${this.currentTable} ADD CONSTRAINT ${column}_regex CHECK (${column} ~ '${pattern}')`);
    } else if (client === 'mysql2') {
      return this.knex.raw(`ALTER TABLE ${this.currentTable} ADD CONSTRAINT ${column}_regex CHECK (${column} REGEXP '${pattern}')`);
    }
    return Promise.resolve();
  }

  generatedAs(column: string, expression: string): Promise<any> {
    const client = this.knex.client.config.client;
    if (client === 'mysql2') {
      return this.knex.raw(`ALTER TABLE ${this.currentTable} ADD ${column} VARCHAR(255) GENERATED ALWAYS AS (${expression}) STORED`);
    } else if (client === 'pg') {
      return this.knex.raw(`ALTER TABLE ${this.currentTable} ADD ${column} TEXT GENERATED ALWAYS AS (${expression}) STORED`);
    }
    return Promise.resolve();
  }

  collate(tableName: string, collation: string): Promise<any> {
    const client = this.knex.client.config.client;
    if (client === 'mysql2') {
      return this.knex.raw(`ALTER TABLE ${tableName} COLLATE ${collation}`);
    } else if (client === 'pg') {
      return this.knex.raw(`ALTER TABLE ${tableName} ALTER COLUMN name TYPE TEXT COLLATE "${collation}"`);
    }
    return Promise.resolve();
  }

  // Enhanced PostgreSQL types
  array(columnName: string, type: string = 'text'): any {
    if (this.knex.client.config.client === 'pg') {
      return this.knex.schema.specificType(columnName, `${type}[]`);
    }
    return this.knex.schema.json(columnName);
  }

  numrange(columnName: string): any {
    return this.knex.schema.specificType(columnName, 'numrange');
  }

  daterange(columnName: string): any {
    return this.knex.schema.specificType(columnName, 'daterange');
  }

  tsvector(columnName: string): any {
    return this.knex.schema.specificType(columnName, 'tsvector');
  }

  // Enhanced MySQL types
  fulltext(columns: string[], indexName?: string): Promise<any> {
    if (this.knex.client.config.client === 'mysql2') {
      const name = indexName || `${columns.join('_')}_fulltext`;
      return this.knex.raw(`ALTER TABLE ${this.currentTable} ADD FULLTEXT INDEX ${name} (${columns.join(', ')})`);
    }
    return Promise.resolve();
  }

  spatial(column: string, indexName?: string): Promise<any> {
    if (this.knex.client.config.client === 'mysql2') {
      const name = indexName || `${column}_spatial`;
      return this.knex.raw(`ALTER TABLE ${this.currentTable} ADD SPATIAL INDEX ${name} (${column})`);
    }
    return Promise.resolve();
  }

  private currentTable: string = '';

  setCurrentTable(tableName: string): this {
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
  enableExtension(name: string): Promise<any> {
    if (this.knex.client.config.client === 'pg') {
      return this.knex.raw(`CREATE EXTENSION IF NOT EXISTS "${name}"`);
    }
    return Promise.resolve();
  }

  createEnum(name: string, values: string[]): Promise<any> {
    if (this.knex.client.config.client === 'pg') {
      return this.knex.raw(`CREATE TYPE ${name} AS ENUM (${values.map(v => `'${v}'`).join(', ')})`);
    }
    return Promise.resolve();
  }

  dropEnum(name: string): Promise<any> {
    if (this.knex.client.config.client === 'pg') {
      return this.knex.raw(`DROP TYPE IF EXISTS ${name}`);
    }
    return Promise.resolve();
  }
}

export default SchemaBuilder;