import Database from '../database/connection.mjs';

class Seeder {
  constructor() {
    this.db = Database;
    this.batchSize = 1000;
  }

  // Batch processing utilities
  async createInBatches(factory, count, attributes = {}) {
    const results = [];
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

  async disableForeignKeyChecks() {
    const client = this.db.connection(this.connection).client.config.client;
    
    if (client === 'mysql2') {
      await this.db.raw('SET FOREIGN_KEY_CHECKS = 0');
    } else if (client === 'pg') {
      await this.db.raw('SET session_replication_role = replica');
    }
  }
  
  async enableForeignKeyChecks() {
    const client = this.db.connection(this.connection).client.config.client;
    
    if (client === 'mysql2') {
      await this.db.raw('SET FOREIGN_KEY_CHECKS = 1');
    } else if (client === 'pg') {
      await this.db.raw('SET session_replication_role = DEFAULT');
    }
  }

  async call(seeders) {
    // Handle both single seeder and array of seeders
    const seederArray = Array.isArray(seeders) ? seeders : [seeders];
    
    for (const SeederClass of seederArray) {
      const seeder = new SeederClass();
      if (this.connection) {
        seeder.connection = this.connection;
      }
      await seeder.run();
      console.log(`Seeded: ${SeederClass.name}`);
    }
  }

  async callWith(seeders, connection) {
    for (const [name, SeederClass] of Object.entries(seeders)) {
      const seeder = new SeederClass();
      if (connection || this.connection) {
        seeder.connection = connection || this.connection;
      }
      await seeder.run();
      console.log(`Seeded: ${name}`);
    }
  }

  async callOnce(SeederClass, identifier) {
    const tableName = 'seeder_log';
    
    // Ensure seeder log table exists
    const knex = this.db.getInstance();
    const hasTable = await knex.schema.hasTable(tableName);
    if (!hasTable) {
      await knex.schema.createTable(tableName, (table) => {
        table.increments('id');
        table.string('seeder');
        table.timestamp('executed_at').defaultTo(knex.fn.now());
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

  async progress(total, callback) {
    let completed = 0;
    const updateProgress = (count) => {
      completed += count;
      const percentage = Math.round((completed / total) * 100);
      console.log(`Progress: ${percentage}% (${completed}/${total})`);
    };
    
    await callback(updateProgress);
  }

  async truncate(table) {
    await this.db.table(table, this.connection).truncate();
  }

  async truncateInOrder(tables) {
    await this.disableForeignKeyChecks();
    
    for (const table of tables) {
      await this.truncate(table);
    }
    
    await this.enableForeignKeyChecks();
  }

  async wipeDatabase() {
    const knex = this.db.connection(this.connection);
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
    
    await this.truncateInOrder(tables);
  }
}

export default Seeder;