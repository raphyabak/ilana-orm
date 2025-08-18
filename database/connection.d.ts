import { Knex } from 'knex';

export interface DatabaseConfig {
  default: string;
  connections: {
    [name: string]: Knex.Config;
  };
  migrations?: {
    directory?: string;
    tableName?: string;
  };
  seeds?: {
    directory?: string;
  };
}

export interface Transaction extends Knex.Transaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export default class Database {
  static connections: Map<string, Knex>;
  static config: DatabaseConfig;
  static defaultConnection: string;
  static instance: Knex;
  private static _currentTransaction: Knex.Transaction | null;

  static configure(config: DatabaseConfig): void;
  static connection(name?: string): Knex;
  static getDefaultConnection(): string;
  static hasConnection(name: string): boolean;
  static getInstance(): Knex;
  static transaction<T>(
    callback: (trx: Knex.Transaction) => Promise<T>,
    attempts?: number,
    connection?: string
  ): Promise<T>;
  static beginTransaction(connection?: string): Promise<Transaction>;
  static commit(trx: Knex.Transaction): Promise<void>;
  static rollback(trx: Knex.Transaction): Promise<void>;
  static getCurrentTransaction(): Knex.Transaction | null;
  static table(tableName: string, connectionName?: string): Knex.QueryBuilder;
  static raw(sql: string, bindings?: any[]): Knex.Raw;
}