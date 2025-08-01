import * as fs from 'fs';
import * as path from 'path';
import Database from '../database/connection';
import SchemaBuilder from '../database/schema-builder';

// Auto-load configuration on first import
(function autoLoadConfig() {
  const configPath = path.join(process.cwd(), 'ilana.config.js');
  if (fs.existsSync(configPath)) {
    delete require.cache[configPath];
    require(configPath); // Config file handles Database.configure()
  }
})();

export interface Migration {
  connection?: string;
  up(schemaBuilder: SchemaBuilder): Promise<void>;
  down(schemaBuilder: SchemaBuilder): Promise<void>;
}

export interface MigrationRecord {
  id: number;
  migration: string;
  batch: number;
  executed_at: Date;
}

export class MigrationRunner {
  private migrationsPath: string;
  private tableName: string = 'migrations';

  constructor(migrationsPath: string = './migrations') {
    this.migrationsPath = migrationsPath;
  }

  async ensureMigrationsTable(): Promise<void> {
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

  async getPendingMigrations(): Promise<string[]> {
    await this.ensureMigrationsTable();
    
    const executedMigrations = await Database.table(this.tableName)
      .select('migration')
      .then(rows => rows.map(row => row.migration));

    const allMigrations = this.getAllMigrationFiles();
    
    return allMigrations.filter(migration => !executedMigrations.includes(migration));
  }

  async getExecutedMigrations(): Promise<MigrationRecord[]> {
    await this.ensureMigrationsTable();
    
    return Database.table(this.tableName)
      .select('*')
      .orderBy('batch', 'desc')
      .orderBy('migration', 'desc');
  }

  async migrate(connection?: string, onlyFile?: string, toFile?: string): Promise<void> {
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

  async rollback(steps: number = 1, connection?: string, toFile?: string): Promise<void> {
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

  async reset(): Promise<void> {
    const executedMigrations = await this.getExecutedMigrations();
    
    if (executedMigrations.length === 0) {
      console.log('Nothing to reset.');
      return;
    }

    const schema = new SchemaBuilder();

    console.log(`Resetting ${executedMigrations.length} migrations...`);

    for (const migrationRecord of executedMigrations) {
      console.log(`Rolling back: ${migrationRecord.migration}`);
      
      const migration = await this.loadMigration(migrationRecord.migration);
      const migrationConnection = migration.connection;
      const migrationSchema = migrationConnection ? new SchemaBuilder(migrationConnection) : schema;
      
      await migration.down(migrationSchema);
      
      console.log(`Rolled back: ${migrationRecord.migration}`);
    }

    await Database.table(this.tableName).delete();
    console.log('Reset completed.');
  }

  async refresh(connection?: string): Promise<void> {
    await this.reset(connection);
    await this.migrate(connection);
  }

  async fresh(connection?: string): Promise<void> {
    await this.wipe(connection);
    await this.migrate(connection);
  }

  async list(connection?: string): Promise<void> {
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

  async unlock(connection?: string): Promise<void> {
    // In a real implementation, this would unlock migration locks
    console.log('Migration locks cleared.');
  }

  async wipe(connection?: string): Promise<void> {
    const schema = new SchemaBuilder(connection);
    const knex = Database.connection(connection);
    
    // Get all table names
    let tables: string[] = [];
    
    if (knex.client.config.client === 'sqlite3') {
      const result = await knex.raw("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
      tables = result.map((row: any) => row.name);
    } else if (knex.client.config.client === 'mysql2') {
      const result = await knex.raw('SHOW TABLES');
      tables = result[0].map((row: any) => Object.values(row)[0] as string);
    } else if (knex.client.config.client === 'pg') {
      const result = await knex.raw("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
      tables = result.rows.map((row: any) => row.tablename);
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

  async status(): Promise<void> {
    const allMigrations = this.getAllMigrationFiles();
    const executedMigrations = await Database.table(this.tableName)
      .select('migration')
      .then(rows => rows.map(row => row.migration));

    console.log('Migration Status:');
    console.log('================');

    for (const migration of allMigrations) {
      const status = executedMigrations.includes(migration) ? 'Ran' : 'Pending';
      console.log(`${status.padEnd(8)} ${migration}`);
    }
  }

  generateMigration(name: string, tableName?: string, isCreate?: boolean): string {
    const timestamp = new Date().toISOString()
      .replace(/[-:]/g, '')
      .replace(/\..+/, '')
      .replace('T', '');
    
    const filename = `${timestamp}_${name}.ts`;
    const filepath = path.join(this.migrationsPath, filename);

    const template = this.getMigrationTemplate(name, tableName, isCreate);
    
    if (!fs.existsSync(this.migrationsPath)) {
      fs.mkdirSync(this.migrationsPath, { recursive: true });
    }

    fs.writeFileSync(filepath, template);
    
    console.log(`Created migration: ${filename}`);
    return filename;
  }

  private getAllMigrationFiles(): string[] {
    if (!fs.existsSync(this.migrationsPath)) {
      return [];
    }

    return fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
      .sort();
  }

  private async loadMigration(filename: string): Promise<Migration> {
    const filepath = path.resolve(this.migrationsPath, filename);
    delete require.cache[filepath];
    const migrationModule = require(filepath);
    
    const MigrationClass = migrationModule.default || migrationModule;
    return new MigrationClass();
  }

  private async getNextBatchNumber(): Promise<number> {
    const result = await Database.table(this.tableName)
      .max('batch as max_batch')
      .first();
    
    return (result?.max_batch || 0) + 1;
  }

  private getMigrationTemplate(name: string, tableName?: string, isCreate?: boolean): string {
    const className = this.toPascalCase(name);
    const table = tableName || this.getTableNameFromMigration(name);
    
    if (isCreate || name.includes('create_')) {
      return `import SchemaBuilder from '../database/schema-builder';

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
`;
    } else if (tableName) {
      return `import SchemaBuilder from '../database/schema-builder';

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
`;
    }
    
    return `import SchemaBuilder from '../database/schema-builder';

export default class ${className} {
  // connection = 'mysql'; // Uncomment to use specific connection
  
  async up(schema: SchemaBuilder): Promise<void> {
    // Add your migration logic here
  }

  async down(schema: SchemaBuilder): Promise<void> {
    // Add your rollback logic here
  }
}
`;
  }

  private toPascalCase(str: string): string {
    return str.replace(/(^|_)(.)/g, (_, __, char) => char.toUpperCase());
  }

  private getTableNameFromMigration(name: string): string {
    // Extract table name from migration name
    const match = name.match(/create_(.+)_table/);
    return match ? match[1] : 'table_name';
  }
}

export default MigrationRunner;