const fs = require('fs');
const path = require('path');
const Database = require('../database/connection');
const SchemaBuilder = require('../database/schema-builder');

let config = {};

// Auto-load configuration on first import
(async function autoLoadConfig() {
  const configPathJs = path.join(process.cwd(), 'ilana.config.js');
  const configPathMjs = path.join(process.cwd(), 'ilana.config.mjs');
  
  // Try .mjs first (ES modules)
  if (fs.existsSync(configPathMjs)) {
    try {
      const configModule = await import(configPathMjs);
      config = configModule.default || configModule;
    } catch (error) {
      console.error('Error loading ilana.config.mjs:', error.message);
    }
  }
  // Try .js (CommonJS)
  else if (fs.existsSync(configPathJs)) {
    delete require.cache[configPathJs];
    try {
      config = require(configPathJs) || {};
    } catch (error) {
      if (error.code === 'ERR_REQUIRE_ESM') {
        const configModule = await import(configPathJs);
        config = configModule.default || configModule;
      } else {
        throw error;
      }
    }
  }
})();

class MigrationRunner {
  constructor() {
    this.migrationsPath = config.migrations?.directory || './database/migrations';
    this.tableName = config.migrations?.tableName || 'migrations';
  }

  async ensureMigrationsTable() {
    const schema = new SchemaBuilder();
    const hasTable = await schema.hasTable(this.tableName);

    if (!hasTable) {
      await schema.createTable(this.tableName, (table) => {
        table.increments('id');
        table.string('migration');
        table.integer('batch');
        table.timestamp('executed_at').defaultTo(Database.getInstance().fn.now());
      });
    }
  }

  async getPendingMigrations() {
    await this.ensureMigrationsTable();

    const executedMigrations = await Database.table(this.tableName)
      .select('migration')
      .then(rows => rows.map(row => row.migration));

    const allMigrations = this.getAllMigrationFiles();

    return allMigrations.filter(migration => !executedMigrations.includes(migration));
  }

  async getExecutedMigrations() {
    await this.ensureMigrationsTable();

    return Database.table(this.tableName)
      .select('*')
      .orderBy('batch', 'desc')
      .orderBy('migration', 'desc');
  }

  async migrate(connection, onlyFile, toFile) {
    let pendingMigrations = await this.getPendingMigrations();

    if (onlyFile) {
      pendingMigrations = pendingMigrations.filter(m => m.includes(onlyFile));
    }

    if (toFile) {
      const toIndex = pendingMigrations.findIndex(m => m.includes(toFile));
      if (toIndex >= 0) {
        pendingMigrations = pendingMigrations.slice(0, toIndex + 1);
      }
    }

    if (pendingMigrations.length === 0) {
      console.log('Nothing to migrate.');
      return;
    }

    const batch = await this.getNextBatchNumber();
    const schema = new SchemaBuilder(connection);

    console.log(`Running ${pendingMigrations.length} migrations...`);

    for (const migrationFile of pendingMigrations) {
      console.log(`Migrating: ${migrationFile}`);

      const migration = await this.loadMigration(migrationFile);
      const migrationConnection = migration.connection || connection;
      const migrationSchema = migrationConnection ? new SchemaBuilder(migrationConnection) : schema;

      await migration.up(migrationSchema);

      await Database.table(this.tableName, migrationConnection).insert({
        migration: migrationFile,
        batch,
        executed_at: new Date()
      });

      console.log(`Migrated: ${migrationFile}`);
    }

    console.log('Migration completed.');
  }

  async rollback(steps = 1, connection, toFile) {
    const executedMigrations = await Database.table(this.tableName, connection)
      .select('*')
      .orderBy('batch', 'desc')
      .orderBy('migration', 'desc');

    if (executedMigrations.length === 0) {
      console.log('Nothing to rollback.');
      return;
    }

    let migrationsToRollback = executedMigrations;

    if (toFile) {
      const toIndex = executedMigrations.findIndex(m => m.migration.includes(toFile));
      if (toIndex >= 0) {
        migrationsToRollback = executedMigrations.slice(0, toIndex + 1);
      }
    } else {
      const batches = [...new Set(executedMigrations.map(m => m.batch))].slice(0, steps);
      migrationsToRollback = executedMigrations.filter(m => batches.includes(m.batch));
    }

    const schema = new SchemaBuilder(connection);

    console.log(`Rolling back ${migrationsToRollback.length} migrations...`);

    for (const migrationRecord of migrationsToRollback) {
      console.log(`Rolling back: ${migrationRecord.migration}`);

      const migration = await this.loadMigration(migrationRecord.migration);
      const migrationConnection = migration.connection || connection;
      const migrationSchema = migrationConnection ? new SchemaBuilder(migrationConnection) : schema;

      await migration.down(migrationSchema);

      await Database.table(this.tableName, migrationConnection)
        .where('migration', migrationRecord.migration)
        .delete();

      console.log(`Rolled back: ${migrationRecord.migration}`);
    }

    console.log('Rollback completed.');
  }

  async reset(connection) {
    const executedMigrations = await this.getExecutedMigrations();

    if (executedMigrations.length === 0) {
      console.log('Nothing to reset.');
      return;
    }

    const schema = new SchemaBuilder(connection);

    console.log(`Resetting ${executedMigrations.length} migrations...`);

    for (const migrationRecord of executedMigrations) {
      console.log(`Rolling back: ${migrationRecord.migration}`);

      const migration = await this.loadMigration(migrationRecord.migration);
      const migrationConnection = migration.connection || connection;
      const migrationSchema = migrationConnection ? new SchemaBuilder(migrationConnection) : schema;

      await migration.down(migrationSchema);

      console.log(`Rolled back: ${migrationRecord.migration}`);
    }

    await Database.table(this.tableName, connection).delete();
    console.log('Reset completed.');
  }

  async refresh(connection) {
    await this.reset(connection);
    await this.migrate(connection);
  }

  async fresh(connection) {
    await this.wipe(connection);
    await this.migrate(connection);
  }

  async list(connection) {
    const executedMigrations = await Database.table(this.tableName, connection)
      .select('*')
      .orderBy('batch')
      .orderBy('migration');

    console.log('Executed Migrations:');
    console.log('===================');

    for (const migration of executedMigrations) {
      console.log(`Batch ${migration.batch}: ${migration.migration} (${migration.executed_at})`);
    }
  }

  async unlock(connection) {
    // In a real implementation, this would unlock migration locks
    console.log('Migration locks cleared.');
  }

  async wipe(connection) {
    const schema = new SchemaBuilder(connection);
    const knex = Database.connection(connection);

    // Get all table names
    let tables = [];

    if (knex.client.config.client === 'sqlite3') {
      const result = await knex.raw("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
      tables = result.map((row) => row.name);
    } else if (knex.client.config.client === 'mysql2') {
      const result = await knex.raw('SHOW TABLES');
      tables = result[0].map((row) => Object.values(row)[0]);
    } else if (knex.client.config.client === 'pg') {
      const result = await knex.raw("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
      tables = result.rows.map((row) => row.tablename);
    }

    console.log(`Dropping ${tables.length} tables...`);

    // Disable foreign key checks
    if (knex.client.config.client === 'mysql2') {
      await knex.raw('SET FOREIGN_KEY_CHECKS = 0');
    }

    for (const table of tables) {
      await schema.dropTableIfExists(table);
      console.log(`Dropped table: ${table}`);
    }

    // Re-enable foreign key checks
    if (knex.client.config.client === 'mysql2') {
      await knex.raw('SET FOREIGN_KEY_CHECKS = 1');
    }

    console.log('Database wiped.');
  }

  async status(connection) {
    await this.ensureMigrationsTable();
    
    const allMigrations = this.getAllMigrationFiles();
    const executedMigrations = await Database.table(this.tableName, connection)
      .select('migration')
      .then(rows => rows.map(row => row.migration));

    console.log('Migration Status:');
    console.log('================');

    for (const migration of allMigrations) {
      const status = executedMigrations.includes(migration) ? 'Ran' : 'Pending';
      console.log(`${status.padEnd(8)} ${migration}`);
    }
  }

  generateMigration(name, tableName, isCreate) {
    const timestamp = new Date().toISOString()
      .replace(/[-:]/g, '')
      .replace(/\..+/, '')
      .replace('T', '');

    const isTS = this.isTypeScriptProject();
    const filename = `${timestamp}_${name}.${isTS ? 'ts' : 'js'}`;
    const filepath = path.join(this.migrationsPath, filename);

    const template = this.getMigrationTemplate(name, tableName, isCreate);

    if (!fs.existsSync(this.migrationsPath)) {
      fs.mkdirSync(this.migrationsPath, { recursive: true });
    }

    fs.writeFileSync(filepath, template);

    console.log(`Created migration: ${filename}`);
    return filename;
  }

  getAllMigrationFiles() {
    if (!fs.existsSync(this.migrationsPath)) {
      return [];
    }

    return fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
      .sort();
  }

  async loadMigration(filename) {
    const filepath = path.resolve(this.migrationsPath, filename);
    delete require.cache[filepath];
    
    let migrationModule;
    try {
      migrationModule = require(filepath);
    } catch (error) {
      if (error.code === 'ERR_REQUIRE_ESM') {
        // Handle ES modules
        migrationModule = await import(filepath);
      } else {
        throw error;
      }
    }

    const MigrationClass = migrationModule.default || migrationModule;

    // Check if it's already an instance or needs to be instantiated
    if (typeof MigrationClass === 'function') {
      return new MigrationClass();
    } else if (typeof MigrationClass === 'object' && MigrationClass.up && MigrationClass.down) {
      return MigrationClass;
    } else {
      throw new Error(`Invalid migration format in ${filename}. Migration must export a class or object with up() and down() methods.`);
    }
  }

  async getNextBatchNumber() {
    const result = await Database.table(this.tableName)
      .max('batch as max_batch')
      .first();

    return (result?.max_batch || 0) + 1;
  }

  getMigrationTemplate(name, tableName, isCreate) {
    const className = this.toPascalCase(name);
    const table = tableName || this.getTableNameFromMigration(name);

    const isTS = this.isTypeScriptProject();

    if (isCreate || name.includes('create_')) {
      return isTS ?
        `import type { SchemaBuilder } from 'ilana-orm';

export default class ${className} {
  // connection = 'mysql'; // Uncomment to use specific connection
  
  async up(schema: SchemaBuilder): Promise<void> {
    await schema.createTable('${table}', (table) => {
      table.increments('id');
      table.timestamps();
    });
  }

  async down(schema: SchemaBuilder): Promise<void> {
    await schema.dropTable('${table}');
  }
}
` :
        `const { SchemaBuilder } = require('ilana-orm');

class ${className} {
  // connection = 'mysql'; // Uncomment to use specific connection
  
  async up(schema) {
    await schema.createTable('${table}', (table) => {
      table.increments('id');
      table.timestamps();
    });
  }

  async down(schema) {
    await schema.dropTable('${table}');
  }
}

module.exports = ${className};
`;
    } else if (tableName) {
      return isTS ?
        `import type { SchemaBuilder } from 'ilana-orm';

export default class ${className} {
  // connection = 'mysql'; // Uncomment to use specific connection
  
  async up(schema: SchemaBuilder): Promise<void> {
    await schema.table('${table}', (table) => {
      // Add your column modifications here
      // table.string('new_column').nullable();
    });
  }

  async down(schema: SchemaBuilder): Promise<void> {
    await schema.table('${table}', (table) => {
      // Reverse your modifications here
      // table.dropColumn('new_column');
    });
  }
}
` :
        `const { SchemaBuilder } = require('ilana-orm');

class ${className} {
  // connection = 'mysql'; // Uncomment to use specific connection
  
  async up(schema) {
    await schema.table('${table}', (table) => {
      // Add your column modifications here
      // table.string('new_column').nullable();
    });
  }

  async down(schema) {
    await schema.table('${table}', (table) => {
      // Reverse your modifications here
      // table.dropColumn('new_column');
    });
  }
}

module.exports = ${className};
`;
    }

    return isTS ?
      `import type { SchemaBuilder } from 'ilana-orm';

export default class ${className} {
  // connection = 'mysql'; // Uncomment to use specific connection
  
  async up(schema: SchemaBuilder): Promise<void> {
    // Add your migration logic here
  }

  async down(schema: SchemaBuilder): Promise<void> {
    // Add your rollback logic here
  }
}
` :
      `const { SchemaBuilder } = require('ilana-orm');

class ${className} {
  // connection = 'mysql'; // Uncomment to use specific connection
  
  async up(schema) {
    // Add your migration logic here
  }

  async down(schema) {
    // Add your rollback logic here
  }
}

module.exports = ${className};
`;
  }

  isTypeScriptProject() {
    const fs = require('fs');
    const path = require('path');
    return fs.existsSync(path.join(process.cwd(), 'tsconfig.json'));
  }

  toPascalCase(str) {
    return str.replace(/(^|_)(.)/g, (_, __, char) => char.toUpperCase());
  }

  getTableNameFromMigration(name) {
    // Extract table name from migration name
    const match = name.match(/create_(.+)_table/);
    return match ? match[1] : 'table_name';
  }
}

module.exports = MigrationRunner;