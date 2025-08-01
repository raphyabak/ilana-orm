import { Knex } from 'knex';
import Database from '../database/connection';
import Collection from './Collection';


export interface PaginationResult<T> {
  data: T[];
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
  from: number;
  to: number;
}

export class QueryBuilder<T = any> {
  protected query: Knex.QueryBuilder;
  protected modelClass: any;
  protected connectionName?: string;
  protected eagerLoad: string[] = [];
  protected eagerLoadConstraints: Record<string, (query: QueryBuilder) => void> = {};

  constructor(tableName: string, modelClass?: any, connectionName?: string) {
    this.query = Database.table(tableName, connectionName);
    this.modelClass = modelClass;
    this.connectionName = connectionName;
  }

  // Where clauses
  where(column: string, operator?: any, value?: any): this {
    if (arguments.length === 2) {
      this.query.where(column, operator);
    } else {
      this.query.where(column, operator, value);
    }
    return this;
  }

  orWhere(column: string, operator?: any, value?: any): this {
    if (arguments.length === 2) {
      this.query.orWhere(column, operator);
    } else {
      this.query.orWhere(column, operator, value);
    }
    return this;
  }

  whereIn(column: string, values: any[]): this {
    this.query.whereIn(column, values);
    return this;
  }

  whereNotIn(column: string, values: any[]): this {
    this.query.whereNotIn(column, values);
    return this;
  }

  whereNull(column: string): this {
    this.query.whereNull(column);
    return this;
  }

  whereNotNull(column: string): this {
    this.query.whereNotNull(column);
    return this;
  }

  whereBetween(column: string, range: [any, any]): this {
    this.query.whereBetween(column, range);
    return this;
  }

  whereJsonContains(column: string, value: any): this {
    const client = this.query.client.config.client;
    if (client === 'pg') {
      this.query.whereRaw(`${column} @> ?`, [JSON.stringify(value)]);
    } else if (client === 'mysql2') {
      this.query.whereRaw(`JSON_CONTAINS(${column}, ?)`, [JSON.stringify(value)]);
    } else {
      this.query.whereJsonObject(column, value);
    }
    return this;
  }

  whereJsonLength(column: string, operator: string, value: number): this {
    const client = this.query.client.config.client;
    if (client === 'pg') {
      this.query.whereRaw(`jsonb_array_length(${column}) ${operator} ?`, [value]);
    } else if (client === 'mysql2') {
      this.query.whereRaw(`JSON_LENGTH(${column}) ${operator} ?`, [value]);
    } else {
      this.query.whereJsonPath(column, '$.length()', operator, value);
    }
    return this;
  }

  whereDate(column: string, operator: string, value: string): this;
  whereDate(column: string, value: string): this;
  whereDate(column: string, operatorOrValue: string, value?: string): this {
    if (value === undefined) {
      this.query.whereRaw(`DATE(${column}) = ?`, [operatorOrValue]);
    } else {
      this.query.whereRaw(`DATE(${column}) ${operatorOrValue} ?`, [value]);
    }
    return this;
  }

  whereMonth(column: string, month: number): this {
    this.query.whereRaw(`MONTH(${column}) = ?`, [month]);
    return this;
  }

  whereYear(column: string, year: number): this {
    this.query.whereRaw(`YEAR(${column}) = ?`, [year]);
    return this;
  }

  whereExists(callback: (query: QueryBuilder) => void): this {
    this.query.whereExists((builder) => {
      const subQuery = new QueryBuilder('', this.modelClass, this.connectionName);
      subQuery.query = builder;
      callback(subQuery);
    });
    return this;
  }

  when<T>(condition: T, callback: (query: this, value: T) => void, otherwise?: (query: this) => void): this {
    if (condition) {
      callback(this, condition);
    } else if (otherwise) {
      otherwise(this);
    }
    return this;
  }

  // Joins
  join(table: string, first: string, operator?: string, second?: string): this {
    this.query.join(table, first, operator, second);
    return this;
  }

  leftJoin(table: string, first: string, operator?: string, second?: string): this {
    this.query.leftJoin(table, first, operator, second);
    return this;
  }

  rightJoin(table: string, first: string, operator?: string, second?: string): this {
    this.query.rightJoin(table, first, operator, second);
    return this;
  }

  // Ordering and limits
  orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.query.orderBy(column, direction);
    return this;
  }

  latest(column: string = 'created_at'): this {
    return this.orderBy(column, 'desc');
  }

  oldest(column: string = 'created_at'): this {
    return this.orderBy(column, 'asc');
  }

  limit(count: number): this {
    this.query.limit(count);
    return this;
  }

  offset(count: number): this {
    this.query.offset(count);
    return this;
  }

  take(count: number): this {
    return this.limit(count);
  }

  skip(count: number): this {
    return this.offset(count);
  }

  // Grouping
  groupBy(...columns: string[]): this {
    this.query.groupBy(...columns);
    return this;
  }

  having(column: string, operator?: any, value?: any): this {
    if (arguments.length === 2) {
      this.query.having(column, operator);
    } else {
      this.query.having(column, operator, value);
    }
    return this;
  }

  // Locking
  lockForUpdate(): this {
    this.query.forUpdate();
    return this;
  }

  sharedLock(): this {
    this.query.forShare();
    return this;
  }

  skipLocked(): this {
    this.query.skipLocked();
    return this;
  }

  noWait(): this {
    this.query.noWait();
    return this;
  }

  // Selection
  select(...columns: string[]): this {
    this.query.select(...columns);
    return this;
  }

  distinct(): this {
    this.query.distinct();
    return this;
  }

  // Raw queries
  whereRaw(sql: string, bindings?: any[]): this {
    this.query.whereRaw(sql, bindings);
    return this;
  }

  selectRaw(sql: string, bindings?: any[]): this {
    this.query.selectRaw(sql, bindings);
    return this;
  }

  // Aggregates
  async count(column: string = '*'): Promise<number> {
    const result = await this.query.count(column as any);
    return parseInt(result[0]['count(*)'] || result[0].count);
  }

  async sum(column: string): Promise<number> {
    const result = await this.query.sum(column as any);
    return parseFloat(result[0][`sum(\`${column}\`)`] || result[0].sum);
  }

  async avg(column: string): Promise<number> {
    const result = await this.query.avg(column as any);
    return parseFloat(result[0][`avg(\`${column}\`)`] || result[0].avg);
  }

  async min(column: string): Promise<any> {
    const result = await this.query.min(column as any);
    return result[0][`min(\`${column}\`)`] || result[0].min;
  }

  async max(column: string): Promise<any> {
    const result = await this.query.max(column as any);
    return result[0][`max(\`${column}\`)`] || result[0].max;
  }

  // Eager loading
  with(...relations: string[]): this {
    this.eagerLoad.push(...relations);
    return this;
  }

  withConstraints(relation: string | Record<string, (query: QueryBuilder) => void>, callback?: (query: QueryBuilder) => void): this {
    if (typeof relation === 'string' && callback) {
      this.eagerLoadConstraints[relation] = callback;
      this.with(relation);
    } else if (typeof relation === 'object') {
      for (const [rel, cb] of Object.entries(relation)) {
        this.eagerLoadConstraints[rel] = cb;
        this.with(rel);
      }
    }
    return this;
  }

  withCount(...relations: string[]): this {
    for (const relation of relations) {
      this.eagerLoad.push(`${relation}_count`);
    }
    return this;
  }

  whereHas(relation: string, callback?: (query: QueryBuilder) => void): this {
    // This would need proper implementation based on relationship definitions
    // For now, basic implementation
    if (callback) {
      const subQuery = new QueryBuilder('', this.modelClass, this.connectionName);
      callback(subQuery);
    }
    return this;
  }

  // Execution methods
  async get(): Promise<T[]> {
    const results = await this.query;
    const models = this.modelClass ? results.map((row: any) => new this.modelClass(row)) : results;
    
    if (this.eagerLoad.length > 0 && this.modelClass) {
      await this.loadRelations(models);
    }
    
    return this.modelClass ? new Collection(models) as any : models;
  }

  async first(): Promise<T | null> {
    const result = await this.query.first();
    if (!result) return null;
    
    const model = this.modelClass ? new this.modelClass(result) : result;
    
    if (this.eagerLoad.length > 0 && this.modelClass) {
      await this.loadRelations([model]);
    }
    
    return model;
  }

  async find(id: any): Promise<T | null> {
    const result = await this.query.where('id', id).first();
    if (!result) return null;
    
    const model = this.modelClass ? new this.modelClass(result) : result;
    
    if (this.eagerLoad.length > 0 && this.modelClass) {
      await this.loadRelations([model]);
    }
    
    return model;
  }

  async findOrFail(id: any): Promise<T> {
    const result = await this.find(id);
    if (!result) {
      throw new Error(`Model not found with id: ${id}`);
    }
    return result;
  }

  async pluck(column: string): Promise<any[]> {
    const results = await this.query.pluck(column);
    return results;
  }

  async exists(): Promise<boolean> {
    const result = await this.query.select(Database.raw('1')).first();
    return !!result;
  }

  // Pagination
  async paginate(page: number = 1, perPage: number = 15): Promise<PaginationResult<T>> {
    const total = await this.count();
    const results = await this.offset((page - 1) * perPage).limit(perPage).get();
    
    return {
      data: results,
      total,
      perPage,
      currentPage: page,
      lastPage: Math.ceil(total / perPage),
      from: (page - 1) * perPage + 1,
      to: Math.min(page * perPage, total)
    };
  }

  async simplePaginate(page: number = 1, perPage: number = 15): Promise<{ data: T[]; hasMore: boolean }> {
    const results = await this.offset((page - 1) * perPage).limit(perPage + 1).get();
    const hasMore = results.length > perPage;
    
    if (hasMore) {
      results.pop();
    }
    
    return { data: results, hasMore };
  }

  async cursorPaginate(perPage: number = 15, cursor?: string, column: string = 'id', direction: 'asc' | 'desc' = 'asc'): Promise<{
    data: T[];
    nextCursor?: string;
    prevCursor?: string;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    path: string;
    perPage: number;
  }> {
    let query = this.clone().orderBy(column, direction);
    
    if (cursor) {
      const operator = direction === 'asc' ? '>' : '<';
      query = query.where(column, operator, cursor);
    }
    
    const results = await query.limit(perPage + 1).get();
    const hasNextPage = results.length > perPage;
    
    if (hasNextPage) {
      results.pop();
    }
    
    const nextCursor = results.length > 0 ? (results[results.length - 1] as any)[column] : undefined;
    const prevCursor = results.length > 0 ? (results[0] as any)[column] : undefined;
    
    return {
      data: results,
      nextCursor: hasNextPage ? String(nextCursor) : undefined,
      prevCursor: cursor ? String(prevCursor) : undefined,
      hasNextPage,
      hasPrevPage: !!cursor,
      path: '',
      perPage
    };
  }

  // Chunking
  async chunk(size: number, callback: (items: T[]) => Promise<void> | void): Promise<void> {
    let page = 1;
    let results: T[];
    
    do {
      results = await this.offset((page - 1) * size).limit(size).get();
      if (results.length > 0) {
        await callback(results);
      }
      page++;
    } while (results.length === size);
  }

  async *cursor(chunkSize: number = 1000): AsyncGenerator<T> {
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      const results = await this.clone().offset(offset).limit(chunkSize).get();
      hasMore = results.length === chunkSize;
      
      for (const result of results) {
        yield result;
      }
      
      offset += chunkSize;
    }
  }

  async *lazy(chunkSize: number = 1000): AsyncGenerator<T> {
    yield* this.cursor(chunkSize);
  }

  // Insert/Update/Delete
  async insert(data: any | any[]): Promise<any> {
    return this.query.insert(data);
  }

  async insertGetId(data: any): Promise<number> {
    const result = await this.query.insert(data).returning('id');
    return result[0];
  }

  async update(data: any): Promise<number> {
    return this.query.update(data);
  }

  async delete(): Promise<number> {
    return this.query.del();
  }

  async upsert(data: any[], uniqueBy: string[], update?: string[]): Promise<any> {
    return this.query.insert(data).onConflict(uniqueBy).merge(update);
  }

  // Eager loading implementation
  private async loadRelations(models: T[]): Promise<void> {
    if (models.length === 0) return;

    for (const relationName of this.eagerLoad) {
      await this.loadRelation(models, relationName);
    }
  }

  private async loadRelation(models: T[], relationName: string): Promise<void> {
    const parts = relationName.split('.');
    const relation = parts[0];
    const nested = parts.slice(1).join('.');

    // Get relation method from first model
    const firstModel = models[0] as any;
    const relationMethod = firstModel[relation];
    
    if (typeof relationMethod !== 'function') {
      throw new Error(`Relation '${relation}' not found on model`);
    }

    const relationInstance = relationMethod.call(firstModel);
    const foreignKey = relationInstance.foreignKey;
    const localKey = relationInstance.localKey;

    // Get all local key values
    const localValues = models.map((model: any) => model.getAttribute(localKey)).filter(Boolean);
    
    if (localValues.length === 0) return;

    // Build relation query
    let relationQuery = new QueryBuilder(relationInstance.related.getTableName(), relationInstance.related, relationInstance.related.getConnectionName())
      .whereIn(foreignKey, localValues);

    // Apply constraints if any
    if (this.eagerLoadConstraints[relationName]) {
      this.eagerLoadConstraints[relationName](relationQuery);
    }

    // Load nested relations
    if (nested) {
      relationQuery = relationQuery.with(nested);
    }

    const relatedModels = await relationQuery.get();

    // Group related models by foreign key
    const grouped: Record<string, any[]> = {};
    for (const relatedModel of relatedModels) {
      const key = (relatedModel as any).getAttribute(foreignKey);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(relatedModel);
    }

    // Assign relations to models
    for (const model of models) {
      const localValue = (model as any).getAttribute(localKey);
      const related = grouped[localValue] || [];
      
      // Set single or collection based on relation type
      if (relationInstance.constructor.name === 'HasOne' || relationInstance.constructor.name === 'BelongsTo') {
        (model as any).relations[relation] = related[0] || null;
      } else {
        (model as any).relations[relation] = related;
      }
    }
  }

  // Clone query
  clone(): QueryBuilder<T> {
    const cloned = new QueryBuilder<T>('', this.modelClass, this.connectionName);
    cloned.query = this.query.clone();
    cloned.eagerLoad = [...this.eagerLoad];
    cloned.eagerLoadConstraints = { ...this.eagerLoadConstraints };
    return cloned;
  }

  // Get underlying Knex query
  toKnex(): Knex.QueryBuilder {
    return this.query;
  }

  // Debug
  toSql(): string {
    return this.query.toSQL().sql;
  }
}

export default QueryBuilder;