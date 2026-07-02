// Model.js
const QueryBuilder = require('./QueryBuilder');
const { HasOne, HasMany, BelongsTo, BelongsToMany, HasManyThrough, MorphTo, MorphMany, MorphOne } = require('./Relation');
const ModelRegistry = require('./ModelRegistry');
const Database = require('../database/connection');

// Auto-load configuration on first import (skipped in edge runtime)
if (typeof process !== 'undefined' && process.versions && process.versions.node && !global.__ILANA_EDGE__) {
  (function autoLoadConfig() {
    const fs = require('fs');
    const path = require('path');
    const configPathJs = path.join(process.cwd(), 'ilana.config.js');
    const configPathMjs = path.join(process.cwd(), 'ilana.config.mjs');

    if (fs.existsSync(configPathJs)) {
      delete require.cache[configPathJs];
      require(configPathJs);
    } else if (fs.existsSync(configPathMjs)) {
      // For ES modules, handled in _getConfig
    }
  })();
}

class Model {
  // --- Static defaults ---
  static table;
  static connection;
  static primaryKey = 'id';
  static keyType = 'int';
  static incrementing = true;
  static timestamps = true;
  static softDeletes = false;
  static fillable = [];
  static guarded = ['*'];
  static casts = {};
  static events = {};
  static globalScopes = new Map();
  static appends = [];
  static timezone = 'UTC';
  static strictLoading = false;
  static touches = [];
  static enums = {};
  static embeddingColumn = 'embedding';
  static embeddingDimensions = 1536;

  // --- Instance props ---
  attributes = {};
  original = {};
  relations = {};
  exists = false;
  wasRecentlyCreated = false;
  _dirty = new Set();

  fillable;
  guarded;
  casts;
  _deferred;

  constructor(attrs = {}) {
    // instance-level fillable/guarded/casts
    this.fillable = Array.isArray(this.fillable) && this.fillable.length
      ? this.fillable
      : this.constructor.fillable;
    this.guarded = Array.isArray(this.guarded) && this.guarded.length
      ? this.guarded
      : this.constructor.guarded;
    this.casts = { ...this.constructor.casts };
    this.appends = Array.isArray(this.appends) && this.appends.length
      ? this.appends
      : this.constructor.appends;

    // Wrap relations in a Proxy for strict loading enforcement
    const modelClass = this.constructor;
    this.relations = new Proxy({}, {
      get(target, key) {
        if (typeof key !== 'string') return target[key];
        if (modelClass.strictLoading && !(key in target)) {
          throw new Error(
            `Strict loading violation: '${key}' was not eager loaded on ${modelClass.name}. ` +
            `Use .with('${key}') in your query.`
          );
        }
        return target[key];
      },
      set(target, key, value) { target[key] = value; return true; },
      has(target, key) { return key in target; },
      ownKeys(target) { return Object.keys(target); },
      getOwnPropertyDescriptor(target, key) { return Object.getOwnPropertyDescriptor(target, key); },
    });

    // defer attribute setting
    if (attrs && Object.keys(attrs).length) this._deferred = attrs;

    // Create property getters for attributes
    this._createAttributeGetters();
  }

  _initialize() {
    if (!this._deferred) return;
    // When initializing from database, bypass fillable/guarded restrictions
    for (const [k, v] of Object.entries(this._deferred)) {
      this.setAttribute(k, v);
    }
    this.syncOriginal();
    this._deferred = null;
    // Recreate getters after initialization
    this._createAttributeGetters();
    this._generateEnumHelpers();
  }

  _createAttributeGetters() {
    // Create getters for all potential attributes
    const allKeys = new Set([
      ...Object.keys(this.attributes || {}),
      ...this.fillable,
      ...(this._deferred ? Object.keys(this._deferred) : []),
      ...(this.appends || [])
    ]);

    for (const key of allKeys) {
      if (!this.hasOwnProperty(key)) {
        Object.defineProperty(this, key, {
          get() {
            return this.getAttribute(key);
          },
          set(value) {
            this.setAttribute(key, value);
          },
          enumerable: false,
          configurable: true
        });
      }
    }
  }

  _generateEnumHelpers() {
    const enums = this.constructor.enums || {};
    for (const [column, values] of Object.entries(enums)) {
      for (const value of values) {
        const pascal = value.charAt(0).toUpperCase() + value.slice(1);
        const isMethod = `is${pascal}`;
        const makeMethod = `make${pascal}`;
        if (!this[isMethod]) {
          this[isMethod] = () => this.getAttribute(column) === value;
        }
        if (!this[makeMethod]) {
          this[makeMethod] = async () => {
            this.setAttribute(column, value);
            return this.save();
          };
        }
      }
    }
  }

  _toPascalCase(key) {
    return key.replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase());
  }

  _selfFk() {
    return this.constructor.name
      .replace(/([A-Z])/g, (m, l, i) => i === 0 ? l.toLowerCase() : '_' + l.toLowerCase())
      + '_id';
  }

  // --- Static registry & resolving ---
  static register() {
    ModelRegistry.register(this.name, this);
  }

  static resolveRelatedModel(related) {
    if (typeof related === 'string') {
      const cls = ModelRegistry.get(related);
      if (!cls) throw new Error(`Model '${related}' not found. Make sure to call ${related}.register().`);
      return cls;
    }

    // If it's a class, ensure it's registered and return from registry if available
    if (typeof related === 'function' && related.name) {
      const registered = ModelRegistry.get(related.name);
      if (registered) {
        return registered;
      }
      // If not registered but is a valid model class, register it now
      if (related.getTableName && typeof related.getTableName === 'function') {
        ModelRegistry.register(related.name, related);
        return related;
      }
    }

    return related;
  }

  // --- Query builder ---
  static query() {

    const qb = new QueryBuilder(this.getTableName(), this, this.getConnectionName());

    // Use current transaction if available
    const currentTrx = Database.getCurrentTransaction();
    if (currentTrx) {
      qb.query = currentTrx(this.getTableName());
      qb._transaction = currentTrx;
    }

    this.applyGlobalScopes(qb);
    return qb;
  }

  static with(...rels) { return this.query().with(...rels); }
  static withCount(...rels) { return this.query().withCount(...rels); }
  static on(connectionOrTrx) {
    if (connectionOrTrx && typeof connectionOrTrx.raw === 'function') {
      // It's a transaction object
      const qb = new QueryBuilder(this.getTableName(), this, null);
      qb.query = connectionOrTrx(this.getTableName());
      qb._transaction = connectionOrTrx;
      return qb;
    }
    // It's a connection name
    return new QueryBuilder(this.getTableName(), this, connectionOrTrx);
  }
  static async all() { return this.query().get(); }
  static async find(id) { return this.query().find(id); }
  static async findBy(column, value) { return this.query().where(column, value).first(); }
  static async first() { return this.query().first(); }
  static async firstOrFail() { return this.query().firstOrFail(); }
  static latest(col) { return this.query().latest(col || this.createdAt || 'created_at'); }
  static oldest(col) { return this.query().oldest(col || this.createdAt || 'created_at'); }
  static withTrashed() { return this.query().withTrashed(); }
  static onlyTrashed() { return this.query().onlyTrashed(); }
  static withoutTrashed() { return this.query().withoutTrashed(); }
  static async findOrFail(id) { return this.query().findOrFail(id); }
  static async insertGetId(data) { return this.query().insertGetId(data); }
  static async upsert(data, uniqueBy, update) { return this.query().upsert(data, uniqueBy, update); }
  static withoutGlobalScopes() {
    return new QueryBuilder(this.getTableName(), this, this.getConnectionName());
  }

  static make(attrs = {}) {
    const inst = new this(attrs);
    inst._initialize();
    if (!this.incrementing && (this.keyType === 'string' || this.keyType === 'uuid' || this.keyType === 'ulid') && !inst.getKey()) {
      inst.setAttribute(this.primaryKey, this._generateKey());
    }
    return inst;
  }

  static async create(attrs = {}) {
    const inst = this.make(attrs);
    await inst.save();
    return inst;
  }

  static generateUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  static generateUlid() {
    const CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    const now = Date.now();
    let t = now;
    let ts = '';
    for (let i = 9; i >= 0; i--) {
      ts = CHARS[t % 32] + ts;
      t = Math.floor(t / 32);
    }
    let rand = '';
    for (let i = 0; i < 16; i++) rand += CHARS[Math.floor(Math.random() * 32)];
    return ts + rand;
  }

  static _generateKey() {
    if (this.keyType === 'ulid') return this.generateUlid();
    return this.generateUuid();
  }

  static async insert(data) { return this.query().insert(data); }
  static async truncate() { return this.query().toKnex().truncate(); }

  static _assertPgVector() {
    const conn = Database.connection(this.connection);
    const client = conn?.client?.config?.client || '';
    if (!client.includes('pg')) {
      throw new Error(
        `${this.name}.search() and ${this.name}.nearestTo() require PostgreSQL with the pgvector extension. ` +
        `Current database client is '${client || 'unknown'}'. ` +
        `Vector search is not supported on MySQL or SQLite.`
      );
    }
  }

  static async nearestTo(vector, { limit = 10, column, distance = 'cosine' } = {}) {
    this._assertPgVector();
    const col = column || this.embeddingColumn;
    const ops = { cosine: '<=>', l2: '<->', inner: '<#>' };
    const op = ops[distance] || '<=>';
    const vectorStr = `[${Array.from(vector).join(',')}]`;
    return this.query()
      .selectRaw(`*, (${col} ${op} ?) as distance`, [vectorStr])
      .orderByRaw(`${col} ${op} ?`, [vectorStr])
      .limit(limit)
      .get();
  }

  static async search(text, { limit = 10, column, distance = 'cosine', provider } = {}) {
    this._assertPgVector();
    const embed = provider || this.embeddingProvider;
    if (!embed) throw new Error(
      `${this.name}.search() requires an embedding provider. ` +
      `Pass { provider: async (text) => number[] } or set ${this.name}.embeddingProvider.`
    );
    const vector = await embed(text);
    return this.nearestTo(vector, { limit, column, distance });
  }
  static async seed(count = 1) {
    const { factory } = require('./Factory');
    return factory(this).times(count).create();
  }
  static async destroy(ids) {
    const idList = Array.isArray(ids) ? ids : [ids];
    if (this.softDeletes) {
      const models = await this.query().whereIn(this.primaryKey, idList).get();
      let count = 0;
      for (const model of models) { await model.delete(); count++; }
      return count;
    }
    return this.query().whereIn(this.primaryKey, idList).delete();
  }
  static async firstOrCreate(a, v) { return (await this.query().where(a).first()) || this.create({ ...a, ...v }); }
  static async firstOrNew(a, v) {
    const existing = await this.query().where(a).first();
    if (existing) return existing;
    const inst = new this({ ...a, ...v });
    inst._initialize();
    return inst;
  }
  static async updateOrCreate(a, v) {
    const existing = await this.query().where(a).first();
    if (existing) {
      await existing.update(v);
      return existing;
    }
    return this.create({ ...a, ...v });
  }

  // scopes
  static addGlobalScope(n, s) {
    if (!Object.hasOwn(this, 'globalScopes')) this.globalScopes = new Map();
    this.globalScopes.set(n, s);
  }
  static removeGlobalScope(n) {
    if (Object.hasOwn(this, 'globalScopes')) this.globalScopes.delete(n);
  }
  static withoutGlobalScope(n) {
    const qb = new QueryBuilder(this.getTableName(), this, this.getConnectionName());
    const scopes = new Map(this.globalScopes);
    scopes.delete(n);
    scopes.forEach(s => s(qb));
    return qb;
  }
  static applyGlobalScopes(qb) {
    const scopes = Object.hasOwn(this, 'globalScopes') ? this.globalScopes : new Map();
    scopes.forEach(s => s(qb));
  }

  // events
  static _addEventHandler(evt, fn) {
    if (!Object.hasOwn(this, 'events')) this.events = {};
    this.events[evt] = this.events[evt] || [];
    this.events[evt].push(fn);
  }
  static creating(fn) { this._addEventHandler('creating', fn); }
  static created(fn) { this._addEventHandler('created', fn); }
  static updating(fn) { this._addEventHandler('updating', fn); }
  static updated(fn) { this._addEventHandler('updated', fn); }
  static saving(fn) { this._addEventHandler('saving', fn); }
  static saved(fn) { this._addEventHandler('saved', fn); }
  static deleting(fn) { this._addEventHandler('deleting', fn); }
  static deleted(fn) { this._addEventHandler('deleted', fn); }
  static restoring(fn) { this._addEventHandler('restoring', fn); }
  static restored(fn) { this._addEventHandler('restored', fn); }

  static observe(observer) {
    if (typeof observer === 'function') {
      const instance = new observer();
      const events = ['creating', 'created', 'updating', 'updated', 'saving', 'saved', 'deleting', 'deleted', 'restoring', 'restored'];
      for (const event of events) {
        if (typeof instance[event] === 'function') {
          this._addEventHandler(event, instance[event].bind(instance));
        }
      }
    } else if (typeof observer === 'object') {
      for (const [event, handler] of Object.entries(observer)) {
        if (typeof handler === 'function') {
          this._addEventHandler(event, handler);
        }
      }
    }
  }
  // static async fireEvent(evt, mdl) { for (const h of this.events[evt] || []) if (await h(mdl) === false) return false; }
  static async fireEvent(evt, mdl) {
    if (this._mutingEvents) return true;
    const ownEvents = Object.hasOwn(this, 'events') ? this.events : {};
    const handlers = ownEvents[evt] || [];
    for (const handler of handlers) {
      if (await handler(mdl) === false) return false;
    }
    return true;
  }

  static async withoutEvents(callback) {
    this._mutingEvents = true;
    try {
      return await callback();
    } finally {
      this._mutingEvents = false;
    }
  }

  static prunable() {
    throw new Error(`${this.name} must implement a static prunable() method that returns a QueryBuilder.`);
  }

  static async prune() {
    const query = this.prunable();
    let pruned = 0;
    await query.chunk(1000, async (models) => {
      for (const model of models) {
        await model.delete();
        pruned++;
      }
    });
    return pruned;
  }

  // --- Instance methods ---
  static getTableName() { return this.table || this.name.toLowerCase() + 's'; }
  static getPrimaryKey() { return this.primaryKey; }
  static getKeyType() { return this.keyType; }
  static getIncrementing() { return this.incrementing; }
  static getConnectionName() { return this.connection; }

  getKey() { return this.attributes[this.constructor.primaryKey]; }

  fill(attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (!this.isFillable(k)) continue;
      this.setAttribute(k, v);
    }
    return this;
  }

  async load(...relations) {
    const qb = new QueryBuilder(this.constructor.getTableName(), this.constructor, this.constructor.getConnectionName());
    qb.eagerLoad = relations.flat();
    await qb.loadRelations([this]);
    return this;
  }

  async loadMissing(...relations) {
    const toLoad = relations.flat().filter(r => !(r.split('.')[0] in this.relations));
    if (toLoad.length) await this.load(...toLoad);
    return this;
  }

  getRelation(key) {
    return this.relations[key];
  }

  relationLoaded(key) {
    return Object.prototype.hasOwnProperty.call(this.relations, key);
  }

  makeHidden(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    this.hidden = [...(this.hidden || []), ...list];
    return this;
  }

  makeVisible(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    this.hidden = (this.hidden || []).filter(k => !list.includes(k));
    return this;
  }

  append(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    this.appends = [...(this.appends || []), ...list];
    this._createAttributeGetters();
    return this;
  }

  isFillable(k) {
    if (Array.isArray(this.fillable) && this.fillable.length) return this.fillable.includes(k);
    if (this.guarded.includes('*')) return false;
    return !this.guarded.includes(k);
  }

  getAttribute(k) {
    const accessor = `get${this._toPascalCase(k)}Attribute`;
    if (typeof this[accessor] === 'function') {
      return this[accessor]();
    }
    const val = this.attributes[k];
    const cast = this.casts[k];
    if (cast && typeof cast === 'object' && typeof cast.get === 'function') {
      return cast.get(val);
    }
    if (cast === 'json' || cast === 'array') {
      try { return JSON.parse(val); } catch { return val; }
    }
    if (cast === 'date' && val != null) return val;
    if (cast === 'boolean') return val == null ? val : Boolean(val);
    if (cast === 'number' || cast === 'float') return val == null ? val : Number(val);
    return val;
  }

  setAttribute(k, v) {
    const mutator = `set${this._toPascalCase(k)}Attribute`;
    if (typeof this[mutator] === 'function') {
      v = this[mutator](v);
    }
    const cast = this.casts[k];
    let val = v;
    if (cast && typeof cast === 'object' && typeof cast.set === 'function') {
      val = cast.set(v);
    } else if (cast === 'json' || cast === 'array') {
      val = typeof v === 'string' ? v : JSON.stringify(v);
    } else if (cast === 'date' && v instanceof Date) {
      const year = v.getFullYear();
      const month = String(v.getMonth() + 1).padStart(2, '0');
      const day = String(v.getDate()).padStart(2, '0');
      const hours = String(v.getHours()).padStart(2, '0');
      const minutes = String(v.getMinutes()).padStart(2, '0');
      const seconds = String(v.getSeconds()).padStart(2, '0');
      val = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
    this.attributes[k] = val;
    if (!this._deferred && this.exists) {
      this._dirty.add(k);
    }
    return this;
  }

  syncOriginal() {
    this.original = { ...this.attributes };
    this._dirty.clear();
  }

  getOriginal(key) {
    return key !== undefined ? this.original[key] : { ...this.original };
  }

  _getCurrentTimestamp() {
    const now = new Date();
    const config = this._getConfig();
    const timezone = this.constructor.timezone || config?.timezone || 'UTC';
    
    if (timezone === 'UTC') return now;
    
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      const parts = Object.fromEntries(
        formatter.formatToParts(now).map(p => [p.type, p.value])
      );
      return new Date(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`);
    } catch {
      return now;
    }
  }

  _getConfig() {
    try {
      const path = require('path');
      const fs = require('fs');
      const configPathJs = path.join(process.cwd(), 'ilana.config.js');
      const configPathMjs = path.join(process.cwd(), 'ilana.config.mjs');
      
      if (fs.existsSync(configPathJs)) {
        delete require.cache[configPathJs];
        return require(configPathJs);
      } else if (fs.existsSync(configPathMjs)) {
        // For ES modules, return a promise or handle async import
        // For now, return null and let the caller handle it
        return null;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async save() {
    this._initialize();

    if (!this.exists) {
      // Creating new record
      if (await this.constructor.fireEvent('creating', this) === false) return false;
      if (await this.constructor.fireEvent('saving', this) === false) return false;

      const createdAtCol = this.constructor.createdAt || 'created_at';
      const updatedAtCol = this.constructor.updatedAt || 'updated_at';

      if (this.constructor.timestamps) {
        const now = this._getCurrentTimestamp();
        this.setAttribute(createdAtCol, now).setAttribute(updatedAtCol, now);
      }

      // Generate UUID/ULID if needed
      const kt = this.constructor.keyType;
      if (!this.constructor.incrementing && (kt === 'string' || kt === 'uuid' || kt === 'ulid') && !this.getKey()) {
        this.setAttribute(this.constructor.primaryKey, this.constructor._generateKey());
      }

      const qb = this.constructor.query();
      if (this.constructor.incrementing) {
        const id = await qb.insertGetId(this.attributes);
        this.setAttribute(this.constructor.primaryKey, id);
      } else {
        await qb.insert(this.attributes);
      }

      this.exists = true;
      this.wasRecentlyCreated = true;
      await this.constructor.fireEvent('created', this);
      await this.constructor.fireEvent('saved', this);
      this.syncOriginal();
    } else if (this.isDirty()) {
      const createdAtCol = this.constructor.createdAt || 'created_at';
      const updatedAtCol = this.constructor.updatedAt || 'updated_at';

      // Updating existing record
      if (await this.constructor.fireEvent('updating', this) === false) return false;
      if (await this.constructor.fireEvent('saving', this) === false) return false;

      if (this.constructor.timestamps) {
        this.setAttribute(updatedAtCol, this._getCurrentTimestamp());
      }

      const updateData = this.getDirty();
      delete updateData[createdAtCol]; // Never update created_at

      if (Object.keys(updateData).length > 0) {
        await this.constructor.query().where(this.constructor.primaryKey, this.getKey()).update(updateData);
      }

      await this.constructor.fireEvent('updated', this);
      await this.constructor.fireEvent('saved', this);
      this.syncOriginal();
    }

    await this._touchRelations();

    return true;
  }

  async _touchRelations() {
    const touches = this.constructor.touches || [];
    for (const relName of touches) {
      if (typeof this[relName] !== 'function') continue;
      const rel = this[relName]();
      if (!rel || rel.constructor.name !== 'BelongsTo') continue;
      const parentClass = rel.getRelatedClass();
      const parentId = this.getAttribute(rel.foreignKey);
      if (!parentId) continue;
      const col = parentClass.updatedAt || 'updated_at';
      await parentClass.query()
        .where(parentClass.primaryKey || 'id', parentId)
        .update({ [col]: new Date() });
    }
  }

  async update(attributes = {}) {
    this.fill(attributes);
    return await this.save();
  }

  isDirty(key) {
    return key ? this._dirty.has(key) : this._dirty.size > 0;
  }

  getDirty() {
    const dirty = {};
    for (const key of this._dirty) {
      dirty[key] = this.attributes[key];
    }
    return dirty;
  }

  async delete() {
    if (!this.exists) return false;

    await this.constructor.fireEvent('deleting', this);

    const deletedAtCol = this.constructor.deletedAt || 'deleted_at';

    if (this.constructor.softDeletes) {
      this.setAttribute(deletedAtCol, new Date());
      await this.save();
    } else {
      await this.constructor.query().where(this.constructor.primaryKey, this.getKey()).delete();
      this.exists = false;
    }

    await this.constructor.fireEvent('deleted', this);
    return true;
  }

  async restore() {
    const deletedAtCol = this.constructor.deletedAt || 'deleted_at';
    if (!this.constructor.softDeletes || !this.getAttribute(deletedAtCol)) {
      return false;
    }

    await this.constructor.fireEvent('restoring', this);

    this.setAttribute(deletedAtCol, null);
    await this.save();

    await this.constructor.fireEvent('restored', this);
    return true;
  }

  trashed() {
    const deletedAtCol = this.constructor.deletedAt || 'deleted_at';
    return this.constructor.softDeletes && this.getAttribute(deletedAtCol) !== null;
  }

  only(keys) {
    const result = {};
    for (const key of keys) {
      if (this.attributes.hasOwnProperty(key)) {
        result[key] = this.getAttribute(key);
      }
    }
    return result;
  }

  except(keys) {
    const result = {};
    for (const [key, value] of Object.entries(this.attributes)) {
      if (!keys.includes(key)) {
        result[key] = this.getAttribute(key);
      }
    }
    return result;
  }

  async increment(column, amount = 1) {
    await this.constructor.query().where(this.constructor.primaryKey, this.getKey()).increment(column, amount);
    this.setAttribute(column, (this.getAttribute(column) || 0) + amount);
    this.syncOriginal();
    return this;
  }

  async decrement(column, amount = 1) {
    await this.constructor.query().where(this.constructor.primaryKey, this.getKey()).decrement(column, amount);
    this.setAttribute(column, (this.getAttribute(column) || 0) - amount);
    this.syncOriginal();
    return this;
  }

  async forceDelete() {
    if (!this.exists) return false;

    await this.constructor.fireEvent('deleting', this);
    await this.constructor.query().where(this.constructor.primaryKey, this.getKey()).delete();
    this.exists = false;
    await this.constructor.fireEvent('deleted', this);
    return true;
  }

  async fresh() {
    if (!this.exists) return null;
    return this.constructor.find(this.getKey());
  }

  is(other) {
    if (!other || !(other instanceof this.constructor)) return false;
    return this.getKey() === other.getKey();
  }

  isNot(other) {
    return !this.is(other);
  }

  replicate(except = []) {
    const exclude = new Set([
      this.constructor.primaryKey,
      ...(this.constructor.timestamps ? ['created_at', 'updated_at'] : []),
      ...except,
    ]);
    const attrs = {};
    for (const [k, v] of Object.entries(this.attributes)) {
      if (!exclude.has(k)) attrs[k] = v;
    }
    const copy = new this.constructor(attrs);
    copy._initialize();
    copy.exists = false;
    copy.wasRecentlyCreated = false;
    return copy;
  }

  // JSON serialization
  toJSON() {
    this._initialize();
    const data = { ...this.attributes };

    // Apply casting and filter hidden attributes
    const result = {};
    const hidden = this.hidden || [];
    for (const [key, value] of Object.entries(data)) {
      if (!hidden.includes(key)) {
        result[key] = this.getAttribute(key);
      }
    }

    // Add appends (computed attributes)
    if (this.appends && this.appends.length) {
      for (const appendKey of this.appends) {
        const methodName = 'get' + appendKey.split('_').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join('') + 'Attribute';

        if (typeof this[methodName] === 'function') {
          try {
            result[appendKey] = this[methodName]();
          } catch (e) {
            // Skip if accessor fails
          }
        }
      }
    }

    // Add relations
    for (const [key, relation] of Object.entries(this.relations)) {
      if (Array.isArray(relation)) {
        result[key] = relation.map(r => r.toJSON ? r.toJSON() : r);
      } else if (relation && relation.toJSON) {
        result[key] = relation.toJSON();
      } else {
        result[key] = relation;
      }
    }

    return result;
  }

  // relations - convert classes to strings to avoid circular dependencies
  hasOne(related, fk, lk) {
    const relatedName = this._resolveRelatedName(related);
    return new HasOne(this, relatedName, fk || this._selfFk(), lk || this.constructor.primaryKey);
  }
  hasMany(related, fk, lk) {
    const relatedName = this._resolveRelatedName(related);
    return new HasMany(this, relatedName, fk || this._selfFk(), lk || this.constructor.primaryKey);
  }
  belongsTo(related, fk, ok) {
    const relatedName = this._resolveRelatedName(related);
    const defaultFk = typeof relatedName === 'string'
      ? relatedName.replace(/([A-Z])/g, (m, l, i) => i === 0 ? l.toLowerCase() : '_' + l.toLowerCase()) + '_id'
      : undefined;
    return new BelongsTo(this, relatedName, fk || defaultFk, ok || this.constructor.primaryKey);
  }
  belongsToMany(related, pivot, fp, rp, pk, rk) {
    const relatedName = this._resolveRelatedName(related);
    return new BelongsToMany(this, relatedName, pivot, fp, rp, pk, rk);
  }

  _resolveRelatedName(related) {
    if (typeof related === 'string') {
      return related;
    }
    if (typeof related === 'function' && related.name) {
      return related.name;
    }
    // Handle circular dependency - empty object case
    if (typeof related === 'object' && Object.keys(related).length === 0) {
      throw new Error('Circular dependency detected. Use string reference instead:Ex. this.belongsToMany("User", ...)');
    }
    return related;
  }
  hasManyThrough(related, through, fk, sk, lk, slk) {
    const relatedName = typeof related === 'function' && related.name ? related.name : related;
    const throughName = typeof through === 'function' && through.name ? through.name : through;
    return new HasManyThrough(this, relatedName, throughName, fk, sk, lk, slk);
  }
  morphTo(type, id) { return new MorphTo(this, type, id); }
  morphOne(related, type, id) {
    const relatedName = typeof related === 'function' && related.name ? related.name : related;
    return new MorphOne(this, relatedName, type, id, this.constructor.name);
  }
  morphMany(related, type, id) {
    const relatedName = typeof related === 'function' && related.name ? related.name : related;
    return new MorphMany(this, relatedName, type, id, this.constructor.name);
  }
}

module.exports = Model;
