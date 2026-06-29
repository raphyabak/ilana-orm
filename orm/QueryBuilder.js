const Database = require('../database/connection');
const Collection = require('./Collection');
const ModelRegistry = require('./ModelRegistry');

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

  static _validOp(op) {
    const allowed = new Set(['=', '!=', '<>', '<', '>', '<=', '>=']);
    if (!allowed.has(op)) throw new Error(`Invalid SQL operator: "${op}"`);
    return op;
  }

  whereJsonContains(column, value) {
    const client = this.query.client.config.client;
    if (client === 'pg') {
      this.query.whereRaw(`?? @> ?`, [column, JSON.stringify(value)]);
    } else if (client === 'mysql2') {
      this.query.whereRaw(`JSON_CONTAINS(??, ?)`, [column, JSON.stringify(value)]);
    } else {
      this.query.whereJsonObject(column, value);
    }
    return this;
  }

  whereJsonLength(column, operator, value) {
    QueryBuilder._validOp(operator);
    const client = this.query.client.config.client;
    if (client === 'pg') {
      this.query.whereRaw(`jsonb_array_length(??) ${operator} ?`, [column, value]);
    } else if (client === 'mysql2') {
      this.query.whereRaw(`JSON_LENGTH(??) ${operator} ?`, [column, value]);
    } else {
      this.query.whereJsonPath(column, '$.length()', operator, value);
    }
    return this;
  }

  whereDate(column, operatorOrValue, value) {
    if (value === undefined) {
      this.query.whereRaw(`DATE(??) = ?`, [column, operatorOrValue]);
    } else {
      QueryBuilder._validOp(operatorOrValue);
      this.query.whereRaw(`DATE(??) ${operatorOrValue} ?`, [column, value]);
    }
    return this;
  }

  whereMonth(column, month) {
    const client = this.query.client?.config?.client;
    if (client === 'pg' || client === 'postgres') {
      this.query.whereRaw(`EXTRACT(MONTH FROM ??) = ?`, [column, month]);
    } else {
      this.query.whereRaw(`MONTH(??) = ?`, [column, month]);
    }
    return this;
  }

  whereYear(column, year) {
    const client = this.query.client?.config?.client;
    if (client === 'pg' || client === 'postgres') {
      this.query.whereRaw(`EXTRACT(YEAR FROM ??) = ?`, [column, year]);
    } else {
      this.query.whereRaw(`YEAR(??) = ?`, [column, year]);
    }
    return this;
  }

  whereDay(column, operatorOrValue, value) {
    const client = this.query.client?.config?.client;
    const isPg = client === 'pg' || client === 'postgres';
    const isSqlite = client === 'sqlite3' || client === 'better-sqlite3';
    if (isPg) {
      if (value === undefined) {
        this.query.whereRaw(`EXTRACT(DAY FROM ??) = ?`, [column, operatorOrValue]);
      } else {
        QueryBuilder._validOp(operatorOrValue);
        this.query.whereRaw(`EXTRACT(DAY FROM ??) ${operatorOrValue} ?`, [column, value]);
      }
    } else if (isSqlite) {
      if (value === undefined) {
        this.query.whereRaw(`CAST(strftime('%d', ??) AS INTEGER) = ?`, [column, operatorOrValue]);
      } else {
        QueryBuilder._validOp(operatorOrValue);
        this.query.whereRaw(`CAST(strftime('%d', ??) AS INTEGER) ${operatorOrValue} ?`, [column, value]);
      }
    } else {
      if (value === undefined) {
        this.query.whereRaw(`DAY(??) = ?`, [column, operatorOrValue]);
      } else {
        QueryBuilder._validOp(operatorOrValue);
        this.query.whereRaw(`DAY(??) ${operatorOrValue} ?`, [column, value]);
      }
    }
    return this;
  }

  whereTime(column, operatorOrValue, value) {
    const client = this.query.client?.config?.client;
    const isPg = client === 'pg' || client === 'postgres';
    const isSqlite = client === 'sqlite3' || client === 'better-sqlite3';
    if (isPg) {
      if (value === undefined) {
        this.query.whereRaw(`(??)::time = ?`, [column, operatorOrValue]);
      } else {
        QueryBuilder._validOp(operatorOrValue);
        this.query.whereRaw(`(??)::time ${operatorOrValue} ?`, [column, value]);
      }
    } else if (isSqlite) {
      if (value === undefined) {
        this.query.whereRaw(`strftime('%H:%M:%S', ??) = ?`, [column, operatorOrValue]);
      } else {
        QueryBuilder._validOp(operatorOrValue);
        this.query.whereRaw(`strftime('%H:%M:%S', ??) ${operatorOrValue} ?`, [column, value]);
      }
    } else {
      if (value === undefined) {
        this.query.whereRaw(`TIME(??) = ?`, [column, operatorOrValue]);
      } else {
        QueryBuilder._validOp(operatorOrValue);
        this.query.whereRaw(`TIME(??) ${operatorOrValue} ?`, [column, value]);
      }
    }
    return this;
  }

  whereNotBetween(column, range) {
    this.query.whereNotBetween(column, range);
    return this;
  }

  orWhereNull(column) {
    this.query.orWhereNull(column);
    return this;
  }

  orWhereNotNull(column) {
    this.query.orWhereNotNull(column);
    return this;
  }

  orWhereIn(column, values) {
    this.query.orWhereIn(column, values);
    return this;
  }

  orWhereNotIn(column, values) {
    this.query.orWhereNotIn(column, values);
    return this;
  }

  orWhereRaw(sql, bindings) {
    this.query.orWhereRaw(sql, bindings);
    return this;
  }

  addSelect(...columns) {
    this.query.column(...columns);
    return this;
  }

  inRandomOrder() {
    const client = this.query.client?.config?.client;
    this.query.orderByRaw(client === 'mysql2' ? 'RAND()' : 'RANDOM()');
    return this;
  }

  forPage(page, perPage = 15) {
    return this.offset((page - 1) * perPage).limit(perPage);
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

  unless(condition, callback, otherwise) {
    if (!condition) {
      callback(this);
    } else if (otherwise) {
      otherwise(this, condition);
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

  innerJoin(table, first, operator, second) {
    this.query.join(table, first, operator, second);
    return this;
  }

  crossJoin(table) {
    this.query.crossJoin(table);
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

  from(table) {
    this.query.from(table);
    return this;
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

  havingRaw(sql, bindings) {
    this.query.havingRaw(sql, bindings);
    return this;
  }

  whereNotExists(callback) {
    this.query.whereNotExists((builder) => {
      const subQb = new QueryBuilder('', null, this.connectionName);
      subQb.query = builder;
      callback(subQb);
    });
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

  _softQuery() {
    let q = this.query.clone();
    if (this.modelClass && this.modelClass.softDeletes) {
      const col = this.modelClass.deletedAt || 'deleted_at';
      if (this._onlyTrashed) q = q.whereNotNull(col);
      else if (!this._includeTrashed) q = q.whereNull(col);
    }
    return q;
  }

  // Aggregates
  async count(column = '*') {
    const result = await this._softQuery().count(column);
    const countValue = result[0]['count(*)'] || result[0].count || result[0]['COUNT(*)'] || result[0]['COUNT'] || 0;
    return parseInt(countValue) || 0;
  }

  async sum(column) {
    const result = await this._softQuery().sum(column);
    return parseFloat(result[0][`sum(\`${column}\`)`] || result[0].sum);
  }

  async avg(column) {
    const result = await this._softQuery().avg(column);
    return parseFloat(result[0][`avg(\`${column}\`)`] || result[0].avg);
  }

  async min(column) {
    const result = await this._softQuery().min(column);
    return result[0][`min(\`${column}\`)`] || result[0].min;
  }

  async max(column) {
    const result = await this._softQuery().max(column);
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
    // Ensure regular model columns are not dropped when we add count subqueries
    const existing = this.query._single?.columns;
    if (!existing || existing.length === 0) {
      this.query.select(`${this.modelClass.getTableName()}.*`);
    }
    for (const relation of relations) {
      try {
        const dummy = this._makeDummy();
        if (!dummy) continue;
        const relFn = this.modelClass.prototype[relation];
        if (typeof relFn !== 'function') continue;
        const rel = relFn.call(dummy);
        const relatedClass = rel.getRelatedClass();
        const relatedTable = relatedClass.getTableName();
        const parentTable = this.modelClass.getTableName();
        let countSql;
        if (rel.constructor.name === 'BelongsTo') {
          countSql = `(SELECT COUNT(*) FROM ${relatedTable} WHERE ${relatedTable}.${rel.localKey || relatedClass.getPrimaryKey()} = ${parentTable}.${rel.foreignKey})`;
        } else {
          countSql = `(SELECT COUNT(*) FROM ${relatedTable} WHERE ${relatedTable}.${rel.foreignKey} = ${parentTable}.${rel.localKey || this.modelClass.getPrimaryKey()})`;
        }
        this.query.column(Database.raw(`${countSql} as ${relation}_count`));
      } catch (_) { /* skip unresolvable relations */ }
    }
    return this;
  }

  whereHas(relation, callback) {
    if (!this.modelClass) return this;
    try {
      const dummy = this._makeDummy();
      const relFn = this.modelClass.prototype[relation];
      if (typeof relFn !== 'function') return this;
      const rel = relFn.call(dummy);
      const relatedClass = rel.getRelatedClass();
      const relatedTable = relatedClass.getTableName();
      const parentTable = this.modelClass.getTableName();
      const isBelongsTo = rel.constructor.name === 'BelongsTo';
      this.query.whereExists((builder) => {
        builder.from(relatedTable);
        if (isBelongsTo) {
          builder.whereRaw(`${relatedTable}.${rel.localKey || relatedClass.getPrimaryKey()} = ${parentTable}.${rel.foreignKey}`);
        } else {
          builder.whereRaw(`${relatedTable}.${rel.foreignKey} = ${parentTable}.${rel.localKey || this.modelClass.getPrimaryKey()}`);
        }
        if (callback) {
          const subQb = new QueryBuilder(relatedTable, relatedClass, this.connectionName);
          subQb.query = builder;
          callback(subQb);
        }
      });
    } catch (_) { /* skip if relation can't be resolved at query-build time */ }
    return this;
  }

  whereDoesntHave(relation, callback) {
    if (!this.modelClass) return this;
    try {
      const dummy = this._makeDummy();
      const relFn = this.modelClass.prototype[relation];
      if (typeof relFn !== 'function') return this;
      const rel = relFn.call(dummy);
      const relatedClass = rel.getRelatedClass();
      const relatedTable = relatedClass.getTableName();
      const parentTable = this.modelClass.getTableName();
      const isBelongsTo = rel.constructor.name === 'BelongsTo';
      this.query.whereNotExists((builder) => {
        builder.from(relatedTable);
        if (isBelongsTo) {
          builder.whereRaw(`${relatedTable}.${rel.localKey || relatedClass.getPrimaryKey()} = ${parentTable}.${rel.foreignKey}`);
        } else {
          builder.whereRaw(`${relatedTable}.${rel.foreignKey} = ${parentTable}.${rel.localKey || this.modelClass.getPrimaryKey()}`);
        }
        if (typeof callback === 'function') {
          const constraintQB = new QueryBuilder(relatedTable, relatedClass, this.connectionName);
          constraintQB.query = builder;
          callback(constraintQB);
        }
      });
    } catch (_) {}
    return this;
  }

  doesntHave(relation) {
    return this.whereDoesntHave(relation);
  }

  _makeDummy() {
    const dummy = Object.create(this.modelClass.prototype);
    dummy.attributes = {};
    dummy.relations = {};
    dummy.casts = this.modelClass.casts || {};
    dummy.fillable = this.modelClass.fillable || [];
    dummy.guarded = this.modelClass.guarded || ['*'];
    dummy.appends = this.modelClass.appends || [];
    dummy.constructor = this.modelClass;
    return dummy;
  }

  // Execution methods
  async get() {
    const query = this._softQuery();
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
    const row = await this._softQuery().first();
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
    const pk = this.modelClass?.primaryKey || 'id';
    const result = await this._softQuery().where(pk, id).first();
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
    if (!result) throw new Error(`Model not found with id: ${id}`);
    return result;
  }

  async firstOrFail() {
    const result = await this.first();
    if (!result) throw new Error('No records found.');
    return result;
  }

  async doesntExist() {
    return !(await this.exists());
  }

  async pluck(column) {
    return await this._softQuery().pluck(column);
  }

  async exists() {
    const result = await this._softQuery().select(Database.raw('1')).first();
    return !!result;
  }

  // Pagination
  async paginate(page = 1, perPage = 15) {
    // Get total count — use _softQuery() to respect soft-delete scope
    const countQuery = new QueryBuilder(this.query._single.table, this.modelClass, this.connectionName);
    countQuery.query = this._softQuery();
    countQuery._includeTrashed = this._includeTrashed;
    countQuery._onlyTrashed = this._onlyTrashed;
    const total = await countQuery.query.count('* as count').then(r => parseInt(r[0]?.count || r[0]?.['count(*)'] || 0));
    
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
      results = await this.clone().offset((page - 1) * size).limit(size).get();
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

    // HasManyThrough requires a JOIN through the intermediate table
    if (relationInstance.constructor.name === 'HasManyThrough') {
      const rel = relationInstance;
      const throughClass = ModelRegistry.has(rel.through) ? ModelRegistry.get(rel.through) : null;
      const throughTable = throughClass ? throughClass.getTableName() : (typeof rel.through === 'string' ? rel.through : rel.through.getTableName());
      const relatedTable = relatedClass.getTableName();
      const parentTable = models[0].constructor.getTableName();

      let hmtQuery = new QueryBuilder(relatedTable, relatedClass, relatedClass.getConnectionName());
      hmtQuery.query = hmtQuery.query
        .select(`${relatedTable}.*`, `${throughTable}.${rel.firstKey} as _hmt_parent_id`)
        .join(throughTable, `${relatedTable}.${rel.secondKey}`, `${throughTable}.${rel.secondLocalKey}`)
        .whereIn(`${throughTable}.${rel.firstKey}`, localValues);

      if (this.eagerLoadConstraints[relationName]) this.eagerLoadConstraints[relationName](hmtQuery);
      if (nested) hmtQuery = hmtQuery.with(nested);

      const hmtResults = await hmtQuery.get();
      const hmtArray = Array.isArray(hmtResults) ? hmtResults : [...hmtResults];

      const grouped = {};
      for (const m of hmtArray) {
        const pid = m.attributes['_hmt_parent_id'];
        delete m.attributes['_hmt_parent_id'];
        if (!grouped[pid]) grouped[pid] = [];
        grouped[pid].push(m);
      }
      for (const model of models) {
        model.relations[relation] = grouped[model.getAttribute(rel.localKey)] || [];
      }
      return;
    }

    // MorphTo: polymorphic parent — group by type and batch-load each model class
    if (relationInstance.constructor.name === 'MorphTo') {
      const rel = relationInstance;
      const typeGroups = {};
      for (const model of models) {
        const morphType = model.getAttribute(rel.morphType);
        const morphId = model.getAttribute(rel.morphId);
        if (!morphType || morphId == null) continue;
        if (!typeGroups[morphType]) typeGroups[morphType] = [];
        typeGroups[morphType].push(morphId);
      }
      const resolved = {};
      for (const [typeName, ids] of Object.entries(typeGroups)) {
        const TypeClass = ModelRegistry.get(typeName);
        if (!TypeClass) continue;
        const rows = await new QueryBuilder(TypeClass.getTableName(), TypeClass, TypeClass.getConnectionName())
          .whereIn(TypeClass.getPrimaryKey(), ids).get();
        for (const row of (Array.isArray(rows) ? rows : [...rows])) {
          resolved[`${typeName}:${row.getAttribute(TypeClass.getPrimaryKey())}`] = row;
        }
      }
      for (const model of models) {
        const morphType = model.getAttribute(rel.morphType);
        const morphId = model.getAttribute(rel.morphId);
        model.relations[relation] = resolved[`${morphType}:${morphId}`] || null;
      }
      return;
    }

    // BelongsToMany requires a join through the pivot table
    if (relationInstance.constructor.name === 'BelongsToMany') {
      const rel = relationInstance;
      const parentPivotKey = rel.parentPivotKey;
      const relatedPivotKey = rel.relatedPivotKey;
      const pivotTable = rel.pivotTable;
      const relatedTable = relatedClass.getTableName();
      const parentKey = rel.parentKey || 'id';
      const relatedKey = rel.relatedKey || relatedClass.getPrimaryKey();

      const parentIds = models.map(m => m.getAttribute(parentKey)).filter(v => v != null);
      const selectColumns = [
        `${relatedTable}.*`,
        `${pivotTable}.${parentPivotKey} as _pivot_parent_id`,
        ...(rel.pivotColumns || []).map(c => `${pivotTable}.${c} as pivot_${c}`)
      ];

      let pivotQuery = new QueryBuilder(relatedTable, relatedClass, relatedClass.getConnectionName());
      pivotQuery.query = pivotQuery.query
        .select(selectColumns)
        .join(pivotTable, `${relatedTable}.${relatedKey}`, `${pivotTable}.${relatedPivotKey}`)
        .whereIn(`${pivotTable}.${parentPivotKey}`, parentIds);

      if (this.eagerLoadConstraints[relationName]) {
        this.eagerLoadConstraints[relationName](pivotQuery);
      }
      if (nested) pivotQuery = pivotQuery.with(nested);

      const pivotResults = await pivotQuery.get();
      const pivotArray = Array.isArray(pivotResults) ? pivotResults : [...pivotResults];

      const grouped = {};
      for (const m of pivotArray) {
        const parentId = m.attributes['_pivot_parent_id'];
        delete m.attributes['_pivot_parent_id'];
        // Extract pivot columns
        if (rel.pivotColumns && rel.pivotColumns.length) {
          m.pivot = {};
          for (const c of rel.pivotColumns) {
            m.pivot[c] = m.attributes[`pivot_${c}`];
            delete m.attributes[`pivot_${c}`];
          }
        }
        if (!grouped[parentId]) grouped[parentId] = [];
        grouped[parentId].push(m);
      }

      for (const model of models) {
        model.relations[relation] = grouped[model.getAttribute(parentKey)] || [];
      }
      return;
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
    } else if (relationInstance.constructor.name === 'MorphMany' || relationInstance.constructor.name === 'MorphOne') {
      const rel = relationInstance;
      relationQuery = relationQuery
        .where(rel.morphType, rel.morphClass)
        .whereIn(rel.morphId, localValues);
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

    const isBelongsTo = relationInstance.constructor.name === 'BelongsTo';
    const isMorphMany = relationInstance.constructor.name === 'MorphMany';
    const isMorphOne = relationInstance.constructor.name === 'MorphOne';

    const grouped = {};
    for (const relatedModel of relatedArray) {
      let groupKey;
      if (isBelongsTo) {
        groupKey = relatedModel.getAttribute(relatedClass.getPrimaryKey());
      } else if (isMorphMany || isMorphOne) {
        groupKey = relatedModel.getAttribute(relationInstance.morphId);
      } else {
        groupKey = relatedModel.getAttribute(foreignKey);
      }
      if (!grouped[groupKey]) grouped[groupKey] = [];
      grouped[groupKey].push(relatedModel);
    }

    for (const model of models) {
      const matchValue = isBelongsTo
        ? model.getAttribute(foreignKey)
        : model.getAttribute(localKey);
      const related = grouped[matchValue] || [];

      if (relationInstance.constructor.name === 'HasOne' || isBelongsTo || isMorphOne) {
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
    if (this._includeTrashed) cloned._includeTrashed = true;
    if (this._onlyTrashed) cloned._onlyTrashed = true;
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
