const Database = require('../database/connection');
const Collection = require('./Collection');

class QueryBuilder {
  constructor(tableName, modelClass, connectionName) {
    this.query = Database.table(tableName, connectionName);
    this.modelClass = modelClass;
    this.connectionName = connectionName;
    this.eagerLoad = [];
    this.eagerLoadConstraints = {};
    this._transaction = null;
    
    // Return proxy to handle scope methods
    return new Proxy(this, {
      get(target, prop) {
        if (prop in target) {
          return target[prop];
        }
        
        // Check if it's a scope method
        const scopeMethod = `scope${prop.charAt(0).toUpperCase()}${prop.slice(1)}`;
        if (target.modelClass && typeof target.modelClass[scopeMethod] === 'function') {
          return function(...args) {
            target.modelClass[scopeMethod](target, ...args);
            return target;
          };
        }
        
        return target[prop];
      }
    });
  }

  // Where clauses
  where(column, operator, value) {
    if (arguments.length === 2) {
      this.query.where(column, operator);
    } else {
      this.query.where(column, operator, value);
    }
    return this;
  }

  orWhere(column, operator, value) {
    if (arguments.length === 2) {
      this.query.orWhere(column, operator);
    } else {
      this.query.orWhere(column, operator, value);
    }
    return this;
  }

  whereIn(column, values) {
    this.query.whereIn(column, values);
    return this;
  }

  whereNotIn(column, values) {
    this.query.whereNotIn(column, values);
    return this;
  }

  whereNull(column) {
    this.query.whereNull(column);
    return this;
  }

  whereNotNull(column) {
    this.query.whereNotNull(column);
    return this;
  }

  whereBetween(column, range) {
    this.query.whereBetween(column, range);
    return this;
  }

  whereJsonContains(column, value) {
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

  whereJsonLength(column, operator, value) {
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

  whereDate(column, operatorOrValue, value) {
    if (value === undefined) {
      this.query.whereRaw(`DATE(${column}) = ?`, [operatorOrValue]);
    } else {
      this.query.whereRaw(`DATE(${column}) ${operatorOrValue} ?`, [value]);
    }
    return this;
  }

  whereMonth(column, month) {
    this.query.whereRaw(`MONTH(${column}) = ?`, [month]);
    return this;
  }

  whereYear(column, year) {
    this.query.whereRaw(`YEAR(${column}) = ?`, [year]);
    return this;
  }

  whereExists(callback) {
    this.query.whereExists((builder) => {
      const subQuery = new QueryBuilder('', this.modelClass, this.connectionName);
      subQuery.query = builder;
      callback(subQuery);
    });
    return this;
  }

  when(condition, callback, otherwise) {
    if (condition) {
      callback(this, condition);
    } else if (otherwise) {
      otherwise(this);
    }
    return this;
  }

  // Joins
  join(table, first, operator, second) {
    this.query.join(table, first, operator, second);
    return this;
  }

  leftJoin(table, first, operator, second) {
    this.query.leftJoin(table, first, operator, second);
    return this;
  }

  rightJoin(table, first, operator, second) {
    this.query.rightJoin(table, first, operator, second);
    return this;
  }

  // Ordering and limits
  orderBy(column, direction = 'asc') {
    this.query.orderBy(column, direction);
    return this;
  }

  latest(column = 'created_at') {
    return this.orderBy(column, 'desc');
  }

  oldest(column = 'created_at') {
    return this.orderBy(column, 'asc');
  }

  limit(count) {
    this.query.limit(count);
    return this;
  }

  offset(count) {
    this.query.offset(count);
    return this;
  }

  take(count) {
    return this.limit(count);
  }

  skip(count) {
    return this.offset(count);
  }

  // Grouping
  groupBy(...columns) {
    this.query.groupBy(...columns);
    return this;
  }

  having(column, operator, value) {
    if (arguments.length === 1) {
      this.query.havingRaw(column);
    } else if (arguments.length === 3) {
      this.query.having(column, operator, value);
    } else {
      throw new Error('Invalid arguments for having(): expected 1 or 3 arguments.');
    }
    return this;
  }

  // Locking
  lockForUpdate() {
    this.query.forUpdate();
    return this;
  }

  sharedLock() {
    this.query.forShare();
    return this;
  }

  skipLocked() {
    this.query.skipLocked();
    return this;
  }

  noWait() {
    this.query.noWait();
    return this;
  }

  // Selection
  select(...columns) {
    this.query.select(...columns);
    return this;
  }

  distinct() {
    this.query.distinct();
    return this;
  }

  // Raw queries
  whereRaw(sql, bindings) {
    this.query.whereRaw(sql, bindings);
    return this;
  }

  selectRaw(sql, bindings) {
    this.query.select(Database.raw(sql, bindings));
    return this;
  }

  // Aggregates
  async count(column = '*') {
    const result = await this.query.count(column);
    // Handle different database result formats
    const countValue = result[0]['count(*)'] || result[0].count || result[0]['COUNT(*)'] || result[0]['COUNT'] || 0;
    return parseInt(countValue) || 0;
  }

  async sum(column) {
    const result = await this.query.sum(column);
    return parseFloat(result[0][`sum(\`${column}\`)`] || result[0].sum);
  }

  async avg(column) {
    const result = await this.query.avg(column);
    return parseFloat(result[0][`avg(\`${column}\`)`] || result[0].avg);
  }

  async min(column) {
    const result = await this.query.min(column);
    return result[0][`min(\`${column}\`)`] || result[0].min;
  }

  async max(column) {
    const result = await this.query.max(column);
    return result[0][`max(\`${column}\`)`] || result[0].max;
  }

  // Eager loading
  with(...relations) {
    this.eagerLoad.push(...relations);
    return this;
  }

  withConstraints(relation, callback) {
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

  withCount(...relations) {
    for (const relation of relations) {
      this.eagerLoad.push(`${relation}_count`);
    }
    return this;
  }

  whereHas(relation, callback) {
    if (callback) {
      const subQuery = new QueryBuilder('', this.modelClass, this.connectionName);
      callback(subQuery);
    }
    return this;
  }

  // Execution methods
  async get() {
    let query = this.query;
    
    // Apply soft delete filtering if model has soft deletes
    if (this.modelClass && this.modelClass.softDeletes) {
      if (this._onlyTrashed) {
        query = query.whereNotNull('deleted_at');
      } else if (!this._includeTrashed) {
        query = query.whereNull('deleted_at');
      }
    }
    
    const rows = await query;
    const models = rows.map(row => {
      const model = new this.modelClass(row);
      model.exists = true;
      model._initialize();
      return model;
    });
    if (this.eagerLoad.length) {
      await this.loadRelations(models);
    }
    return new Collection(models);
  }

  async first() {
    let query = this.query;
    
    // Apply soft delete filtering if model has soft deletes
    if (this.modelClass && this.modelClass.softDeletes) {
      if (this._onlyTrashed) {
        query = query.whereNotNull('deleted_at');
      } else if (!this._includeTrashed) {
        query = query.whereNull('deleted_at');
      }
    }
    
    const row = await query.first();
    if (!row) return null;
    const model = new this.modelClass(row);
    model.exists = true;
    model._initialize();
    if (this.eagerLoad.length) {
      await this.loadRelations([model]);
    }
    return model;
  }


  async find(id) {
    let query = this.query.where('id', id);
    
    // Apply soft delete filtering if model has soft deletes
    if (this.modelClass && this.modelClass.softDeletes) {
      if (this._onlyTrashed) {
        query = query.whereNotNull('deleted_at');
      } else if (!this._includeTrashed) {
        query = query.whereNull('deleted_at');
      }
    }
    
    const result = await query.first();
    if (!result) return null;

    const model = this.modelClass ? new this.modelClass(result) : result;
    if (this.modelClass) {
      model.exists = true;
      model._initialize();
    }

    if (this.eagerLoad.length > 0 && this.modelClass) {
      await this.loadRelations([model]);
    }

    return model;
  }

  async findOrFail(id) {
    const result = await this.find(id);
    if (!result) {
      throw new Error(`Model not found with id: ${id}`);
    }
    return result;
  }

  async pluck(column) {
    return await this.query.pluck(column);
  }

  async exists() {
    const result = await this.query.select(Database.raw('1')).first();
    return !!result;
  }

  // Pagination
  async paginate(page = 1, perPage = 15) {
    // Get total count first with a fresh query
    const countQuery = new QueryBuilder(this.query._single.table, this.modelClass, this.connectionName);
    countQuery.query = this.query.clone();
    const total = await countQuery.count();
    
    // Get the actual data with limit and offset
    const results = await this.clone().offset((page - 1) * perPage).limit(perPage).get();
    
    const lastPage = Math.ceil(total / perPage) || 1;
    const hasData = results.length > 0;

    return {
      data: results,
      total,
      perPage,
      currentPage: page,
      lastPage,
      from: hasData ? (page - 1) * perPage + 1 : null,
      to: hasData ? Math.min((page - 1) * perPage + results.length, total) : null,
      nextPage: page < lastPage ? page + 1 : null
    };
  }

  async simplePaginate(page = 1, perPage = 15) {
    const results = await this.offset((page - 1) * perPage).limit(perPage + 1).get();
    const hasMore = results.length > perPage;

    if (hasMore) {
      results.pop();
    }

    return { data: results, hasMore };
  }

  async cursorPaginate(perPage = 15, cursor, column = 'id', direction = 'asc') {
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

    const nextCursor = results.length > 0 ? results[results.length - 1][column] : undefined;
    const prevCursor = results.length > 0 ? results[0][column] : undefined;

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
  async chunk(size, callback) {
    let page = 1;
    let results;

    do {
      results = await this.offset((page - 1) * size).limit(size).get();
      if (results.length > 0) {
        await callback(results);
      }
      page++;
    } while (results.length === size);
  }

  async *cursor(chunkSize = 1000) {
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

  async *lazy(chunkSize = 1000) {
    yield* this.cursor(chunkSize);
  }

  // Insert/Update/Delete
  async insert(data) {
    return this.query.insert(data);
  }

  async insertGetId(data) {
    // Use the second argument for 'returning'. Knex handles this across
    // different dialects without issuing warnings for MySQL.
    const result = await this.query.insert(data, this.modelClass.getPrimaryKey());

    // The result format differs between DBs.
    // - MySQL/SQLite: [123]
    // - Postgres: [{id: 123}]
    // This handles both cases.
    if (result && result.length > 0) {
      const firstItem = result[0];
      return typeof firstItem === 'object' ? firstItem[this.modelClass.getPrimaryKey()] : firstItem;
    }
    return null;
  }

  async update(data) {
    return this.query.update(data);
  }

  async delete() {
    return this.query.del();
  }

  async upsert(data, uniqueBy, update) {
    return this.query.insert(data).onConflict(uniqueBy).merge(update);
  }

  // Eager loading implementation
  async loadRelations(models) {
    if (models.length === 0) return;

    for (const relationName of this.eagerLoad) {
      await this.loadRelation(models, relationName);
    }
  }

  async loadRelation(models, relationName) {
    const parts = relationName.split('.');
    const relation = parts[0];
    const nested = parts.slice(1).join('.');

    const firstModel = models[0];
    const relationMethod = firstModel[relation];

    if (typeof relationMethod !== 'function') {
      throw new Error(`Relation '${relation}' not found on model`);
    }

    const relationInstance = relationMethod.call(firstModel);
    const foreignKey = relationInstance.foreignKey;
    const localKey = relationInstance.localKey;

    const localValues = models.map(model => model.getAttribute(localKey)).filter(Boolean);

    if (localValues.length === 0) return;

    // Get the related class - should now always be a string
    const relatedClass = relationInstance.getRelatedClass();
    
    // Safety check
    if (!relatedClass || typeof relatedClass.getTableName !== 'function') {
      throw new Error(`Invalid related class for relation '${relation}'. Make sure the model is properly defined and registered.`);
    }

    let relationQuery = new QueryBuilder(
      relatedClass.getTableName(),
      relatedClass,
      relatedClass.getConnectionName()
    );

    // For BelongsTo, we query the related table by its primary key using foreign key values
    if (relationInstance.constructor.name === 'BelongsTo') {
      const foreignValues = models.map(model => model.getAttribute(foreignKey)).filter(Boolean);
      relationQuery = relationQuery.whereIn(relatedClass.getPrimaryKey(), foreignValues);
    } else {
      relationQuery = relationQuery.whereIn(foreignKey, localValues);
    }

    if (this.eagerLoadConstraints[relationName]) {
      this.eagerLoadConstraints[relationName](relationQuery);
    }

    if (nested) {
      relationQuery = relationQuery.with(nested);
    }

    const relatedModels = await relationQuery.get();

    // Convert Collection to array if needed
    const relatedArray = Array.isArray(relatedModels) ? relatedModels : (relatedModels && relatedModels.length !== undefined ? [...relatedModels] : []);

    const grouped = {};
    for (let i = 0; i < relatedArray.length; i++) {
      const relatedModel = relatedArray[i];
      const key = relatedModel.getAttribute(relatedClass.getPrimaryKey());
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(relatedModel);
    }

    for (const model of models) {
      let matchValue;
      if (relationInstance.constructor.name === 'BelongsTo') {
        matchValue = model.getAttribute(foreignKey);
      } else {
        matchValue = model.getAttribute(localKey);
      }
      const related = grouped[matchValue] || [];

      if (relationInstance.constructor.name === 'HasOne' || relationInstance.constructor.name === 'BelongsTo') {
        model.relations[relation] = related[0] || null;
      } else {
        model.relations[relation] = related;
      }
    }
  }

  // Connection switching
  connection(name) {
    const newBuilder = new QueryBuilder(this.query._single.table, this.modelClass, name);
    newBuilder.query = Database.table(this.query._single.table, name);
    return newBuilder;
  }

  on(connectionOrTrx) {
    if (connectionOrTrx && typeof connectionOrTrx.raw === 'function') {
      // It's a transaction object
      const newBuilder = new QueryBuilder('', this.modelClass, null);
      newBuilder.query = connectionOrTrx(this.query._single?.table || this.modelClass.getTableName());
      newBuilder._transaction = connectionOrTrx;
      return newBuilder;
    }
    // It's a connection name
    return this.connection(connectionOrTrx);
  }

  // Clone query
  clone() {
    const cloned = new QueryBuilder('', this.modelClass, this.connectionName);
    cloned.query = this.query.clone();
    cloned.eagerLoad = [...this.eagerLoad];
    cloned.eagerLoadConstraints = { ...this.eagerLoadConstraints };
    return cloned;
  }

  // Get underlying Knex query
  toKnex() {
    return this.query;
  }

  // Soft delete methods
  withTrashed() {
    this._includeTrashed = true;
    return this;
  }

  onlyTrashed() {
    this._onlyTrashed = true;
    return this;
  }

  withoutTrashed() {
    this._withoutTrashed = true;
    return this;
  }

  // Debug
  toSql() {
    return this.query.toSQL().sql;
  }
}

module.exports = QueryBuilder;
