import knex, { Knex } from 'knex';

export interface ConnectionConfig {
  client: 'pg' | 'mysql2' | 'sqlite3';
  connection: {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    filename?: string;
  };
}

export interface DatabaseConfig {
  default: string;
  connections: Record<string, ConnectionConfig>;
  migrations?: {
    directory: string;
    tableName: string;
  };
  seeds?: {
    directory: string;
  };
}

class Database {
  private static instance: Knex;
  private static config: DatabaseConfig;
  private static connections: Map<string, Knex> = new Map();
  private static defaultConnection: string;

  static configure(config: DatabaseConfig): void {
    this.config = config;
    this.defaultConnection = config.default;
    
    // Initialize all configured connections
    for (const [name, connConfig] of Object.entries(config.connections)) {
      const connection = knex({
        client: connConfig.client,
        connection: connConfig.connection,
        migrations: config.migrations || {
          directory: './migrations',
          tableName: 'migrations'
        },
        seeds: config.seeds || {
          directory: './seeds'
        }
      });
      this.connections.set(name, connection);
      
      // Set default instance
      if (name === this.defaultConnection) {
        this.instance = connection;
      }
    }
    
    if (!this.instance) {
      throw new Error(`Default connection '${this.defaultConnection}' not found in connections config.`);
    }
  }

  static connection(name?: string): Knex {
    if (!name) return this.getInstance();
    const conn = this.connections.get(name);
    if (!conn) {
      throw new Error(`Database connection '${name}' not configured.`);
    }
    return conn;
  }

  static getDefaultConnection(): string {
    return this.defaultConnection;
  }

  static hasConnection(name: string): boolean {
    return this.connections.has(name);
  }

  static getInstance(): Knex {
    if (!this.instance) {
      throw new Error('Database not configured. Call Database.configure() first.');
    }
    return this.instance;
  }

  static async transaction<T>(callback: (trx: Knex.Transaction) => Promise<T>, connection?: string): Promise<T> {
    return this.connection(connection).transaction(callback);
  }

  static async beginTransaction(connection?: string): Promise<Knex.Transaction> {
    return this.connection(connection).transaction();
  }

  static table(tableName: string, connectionName?: string): Knex.QueryBuilder {
    return this.connection(connectionName)(tableName);
  }

  static raw(sql: string, bindings?: any[]): Knex.Raw {
    return this.getInstance().raw(sql, bindings);
  }
}

export default Database;