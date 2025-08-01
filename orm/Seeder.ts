import Database from '../database/connection';

export abstract class Seeder {
  protected connection?: string;
  protected db = Database;
  protected batchSize: number = 1000;

  abstract run(): Promise<void>;

  // Batch processing utilities
  protected async createInBatches<T>(factory: any, count: number, attributes: any = {}): Promise<T[]> {
    const results: T[] = [];
    const batches = Math.ceil(count / this.batchSize);
    
    for (let i = 0; i < batches; i++) {
      const currentBatchSize = Math.min(this.batchSize, count - (i * this.batchSize));
      const batch = await factory.times(currentBatchSize).create(attributes);
      results.push(...(Array.isArray(batch) ? batch : [batch]));
      
      if (batches > 1) {
        console.log(`Batch ${i + 1}/${batches} completed (${results.length}/${count})`);
      }
    }
    
    return results;
  }

  protected async disableForeignKeyChecks(): Promise<void> {
    const client = this.db.connection(this.connection).client.config.client;
    
    if (client === 'mysql2') {
      await this.db.raw('SET FOREIGN_KEY_CHECKS = 0');
    } else if (client === 'pg') {
      await this.db.raw('SET session_replication_role = replica');
    }
  }
  
  protected async enableForeignKeyChecks(): Promise<void> {
    const client = this.db.connection(this.connection).client.config.client;
    
    if (client === 'mysql2') {
      await this.db.raw('SET FOREIGN_KEY_CHECKS = 1');
    } else if (client === 'pg') {
      await this.db.raw('SET session_replication_role = DEFAULT');
    }
  }

  protected async call(seeders: (new () => Seeder)[]): Promise<void> {
    for (const SeederClass of seeders) {
      const seeder = new SeederClass();
      if (this.connection) {
        seeder.connection = this.connection;
      }
      await seeder.run();
      console.log(`Seeded: ${SeederClass.name}`);
    }
  }

  protected async callWith(seeders: Record<string, new () => Seeder>, connection?: string): Promise<void> {
    for (const [name, SeederClass] of Object.entries(seeders)) {
      const seeder = new SeederClass();
      if (connection || this.connection) {
        seeder.connection = connection || this.connection;
      }
      await seeder.run();
      console.log(`Seeded: ${name}`);
    }
  }

  protected async callOnce(SeederClass: new () => Seeder, identifier: string): Promise<void> {
    const tableName = 'seeder_log';
    
    // Ensure seeder log table exists
    const hasTable = await this.db.schema.hasTable(tableName);
    if (!hasTable) {
      await this.db.schema.createTable(tableName, (table) => {
        table.increments('id');
        table.string('seeder');
        table.timestamp('executed_at').defaultTo(this.db.fn.now());
      });
    }
    
    // Check if already executed
    const exists = await this.db.table(tableName).where('seeder', identifier).first();
    if (exists) {
      console.log(`Skipped: ${identifier} (already executed)`);
      return;
    }
    
    // Execute seeder
    const seeder = new SeederClass();
    if (this.connection) {
      seeder.connection = this.connection;
    }
    await seeder.run();
    
    // Log execution
    await this.db.table(tableName).insert({
      seeder: identifier,
      executed_at: new Date()
    });
    
    console.log(`Seeded: ${identifier}`);
  }

  protected async progress(total: number, callback: (progress: (completed: number) => void) => Promise<void>): Promise<void> {
    let completed = 0;
    const updateProgress = (count: number) => {
      completed += count;
      const percentage = Math.round((completed / total) * 100);
      console.log(`Progress: ${percentage}% (${completed}/${total})`);
    };
    
    await callback(updateProgress);
  }

  protected async truncate(table: string): Promise<void> {
    await this.db.table(table, this.connection).truncate();
  }

  protected async truncateInOrder(tables: string[]): Promise<void> {
    await this.disableForeignKeyChecks();
    
    for (const table of tables) {
      await this.truncate(table);
    }
    
    await this.enableForeignKeyChecks();
  }

  protected async wipeDatabase(): Promise<void> {
    const knex = this.db.connection(this.connection);
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
    
    await this.truncateInOrder(tables);
  }
}

export default Seeder;