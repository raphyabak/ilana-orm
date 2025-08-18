import Collection from './Collection';
import Model from './Model';

export interface PaginationResult<T> {
  data: Collection<T>;
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
  from: number | null;
  to: number | null;
  nextPage: number | null;
}

export interface SimplePaginationResult<T> {
  data: Collection<T>;
  hasMore: boolean;
}

export interface CursorPaginationResult<T> {
  data: Collection<T>;
  nextCursor?: string;
  prevCursor?: string;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  path: string;
  perPage: number;
}

export default class QueryBuilder {
  protected query: any;
  protected modelClass: typeof Model;
  protected connectionName?: string;
  protected eagerLoad: string[];
  protected eagerLoadConstraints: { [key: string]: (query: QueryBuilder) => void };
  protected _transaction?: any;
  protected _includeTrashed?: boolean;
  protected _onlyTrashed?: boolean;
  protected _withoutTrashed?: boolean;

  constructor(tableName: string, modelClass: typeof Model, connectionName?: string);

  // Where clauses
  where(column: string, value: any): this;
  where(column: string, operator: string, value: any): this;
  orWhere(column: string, value: any): this;
  orWhere(column: string, operator: string, value: any): this;
  whereIn(column: string, values: any[]): this;
  whereNotIn(column: string, values: any[]): this;
  whereNull(column: string): this;
  whereNotNull(column: string): this;
  whereBetween(column: string, range: [any, any]): this;
  whereJsonContains(column: string, value: any): this;
  whereJsonLength(column: string, operator: string, value: number): this;
  whereDate(column: string, value: string): this;
  whereDate(column: string, operator: string, value: string): this;
  whereMonth(column: string, month: number): this;
  whereYear(column: string, year: number): this;
  whereExists(callback: (query: QueryBuilder) => void): this;
  when<T>(condition: T, callback: (query: this, condition: T) => void, otherwise?: (query: this) => void): this;

  // Joins
  join(table: string, first: string, operator: string, second: string): this;
  leftJoin(table: string, first: string, operator: string, second: string): this;
  rightJoin(table: string, first: string, operator: string, second: string): this;

  // Ordering and limits
  orderBy(column: string, direction?: 'asc' | 'desc'): this;
  latest(column?: string): this;
  oldest(column?: string): this;
  limit(count: number): this;
  offset(count: number): this;
  take(count: number): this;
  skip(count: number): this;

  // Grouping
  groupBy(...columns: string[]): this;
  having(column: string, operator: string, value: any): this;
  having(rawSql: string): this;

  // Locking
  lockForUpdate(): this;
  sharedLock(): this;
  skipLocked(): this;
  noWait(): this;

  // Selection
  select(...columns: string[]): this;
  distinct(): this;

  // Raw queries
  whereRaw(sql: string, bindings?: any[]): this;
  selectRaw(sql: string, bindings?: any[]): this;

  // Aggregates
  count(column?: string): Promise<number>;
  sum(column: string): Promise<number>;
  avg(column: string): Promise<number>;
  min(column: string): Promise<any>;
  max(column: string): Promise<any>;

  // Eager loading
  with(...relations: string[]): this;
  withConstraints(relation: string, callback: (query: QueryBuilder) => void): this;
  withConstraints(relations: { [key: string]: (query: QueryBuilder) => void }): this;
  withCount(...relations: string[]): this;
  whereHas(relation: string, callback?: (query: QueryBuilder) => void): this;

  // Execution methods
  get(): Promise<Collection<Model>>;
  first(): Promise<Model | null>;
  find(id: any): Promise<Model | null>;
  findOrFail(id: any): Promise<Model>;
  pluck(column: string): Promise<any[]>;
  exists(): Promise<boolean>;

  // Pagination
  paginate(page?: number, perPage?: number): Promise<PaginationResult<Model>>;
  simplePaginate(page?: number, perPage?: number): Promise<SimplePaginationResult<Model>>;
  cursorPaginate(perPage?: number, cursor?: string, column?: string, direction?: 'asc' | 'desc'): Promise<CursorPaginationResult<Model>>;

  // Chunking
  chunk(size: number, callback: (models: Collection<Model>) => Promise<void>): Promise<void>;
  cursor(chunkSize?: number): AsyncGenerator<Model, void, unknown>;
  lazy(chunkSize?: number): AsyncGenerator<Model, void, unknown>;

  // Insert/Update/Delete
  insert(data: any | any[]): Promise<any>;
  insertGetId(data: any): Promise<any>;
  update(data: any): Promise<number>;
  delete(): Promise<number>;
  upsert(data: any[], uniqueBy: string[], update?: string[]): Promise<any>;

  // Connection switching
  connection(name: string): QueryBuilder;
  on(connectionOrTrx: string | any): QueryBuilder;

  // Clone query
  clone(): QueryBuilder;

  // Get underlying Knex query
  toKnex(): any;

  // Soft delete methods
  withTrashed(): this;
  onlyTrashed(): this;
  withoutTrashed(): this;

  // Debug
  toSql(): string;

  // Protected methods
  protected loadRelations(models: Model[]): Promise<void>;
  protected loadRelation(models: Model[], relationName: string): Promise<void>;
}