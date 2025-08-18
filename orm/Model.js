// Model.js
const QueryBuilder = require('./QueryBuilder');
const { HasOne, HasMany, BelongsTo, BelongsToMany, HasManyThrough, MorphTo, MorphMany } = require('./Relation');
const ModelRegistry = require('./ModelRegistry');
const Database = require('../database/connection');

// Auto-load configuration on first import
(function autoLoadConfig() {
  const fs = require('fs');
  const path = require('path');
  const configPathJs = path.join(process.cwd(), 'ilana.config.js');
  const configPathMjs = path.join(process.cwd(), 'ilana.config.mjs');
  
  if (fs.existsSync(configPathJs)) {
    delete require.cache[configPathJs];
    require(configPathJs);
  } else if (fs.existsSync(configPathMjs)) {
    // For ES modules, we'll handle this in the _getConfig method
  }
})();

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
  }

  _createAttributeGetters() {
    // Create getters for all potential attributes
    const allKeys = new Set([
      ...Object.keys(this.attributes || {}),
      ...this.fillable,
      ...(this._deferred ? Object.keys(this._deferred) : [])
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
  static latest(col) { return this.query().latest(col || 'created_at'); }
  static oldest(col) { return this.query().oldest(col || 'created_at'); }

  static make(attrs = {}) {
    const inst = new this(attrs);
    inst._initialize();
    if (!this.incrementing && this.keyType === 'string' && !inst.getKey()) {
      inst.setAttribute(this.primaryKey, this.generateUuid());
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

  static async insert(data) { return this.query().insert(data); }
  static async destroy(ids) { return this.query().whereIn(this.primaryKey, Array.isArray(ids) ? ids : [ids]).delete(); }
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
  static addGlobalScope(n, s) { this.globalScopes.set(n, s); }
  static removeGlobalScope(n) { this.globalScopes.delete(n); }
  static withoutGlobalScope(n) {
    const qb = new QueryBuilder(this.getTableName(), this, this.getConnectionName());
    const scopes = new Map(this.globalScopes);
    scopes.delete(n);
    scopes.forEach(s => s(qb));
    return qb;
  }
  static applyGlobalScopes(qb) { this.globalScopes.forEach(s => s(qb)); }

  // events
  static _addEventHandler(evt, fn) { this.events[evt] = this.events[evt] || []; this.events[evt].push(fn); }
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
    const handlers = this.events[evt] || [];
    for (const handler of handlers) {
      if (await handler(mdl) === false) return false;
    }
    return true;
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

  isFillable(k) {
    if (Array.isArray(this.fillable) && this.fillable.length) return this.fillable.includes(k);
    if (this.guarded.includes('*')) return false;
    return !this.guarded.includes(k);
  }

  getAttribute(k) {
    const val = this.attributes[k];
    const cast = this.casts[k];
    if (cast === 'json' || cast === 'array') {
      try { return JSON.parse(val); } catch { return val; }
    }
    if (cast === 'date' && val != null) {
      const config = this._getConfig();
      const timezone = this.constructor.timezone || config?.timezone || 'UTC';

      try {
        // Try moment-timezone first
        const moment = require('moment-timezone');
        // Parse the stored value as if it's in the configured timezone
        return moment.tz(val, timezone).format('YYYY-MM-DD HH:mm:ss');
      } catch (e) {
        // Fallback: return the stored value as-is since it's already in the correct timezone
        return val;
      }
    }
    return val;
  }

  setAttribute(k, v) {
    const cast = this.casts[k];
    let val = v;
    if (cast === 'json' || cast === 'array') {
      val = typeof v === 'string' ? v : JSON.stringify(v);
    }
    if (cast === 'date' && v instanceof Date) {
      // Format date for database storage (YYYY-MM-DD HH:mm:ss)
      const year = v.getFullYear();
      const month = String(v.getMonth() + 1).padStart(2, '0');
      const day = String(v.getDate()).padStart(2, '0');
      const hours = String(v.getHours()).padStart(2, '0');
      const minutes = String(v.getMinutes()).padStart(2, '0');
      const seconds = String(v.getSeconds()).padStart(2, '0');
      val = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
    this.attributes[k] = val;
    // Only mark as dirty if not during initialization and model exists
    if (!this._deferred && this.exists) {
      this._dirty.add(k);
    }
    return this;
  }

  syncOriginal() {
    this.original = { ...this.attributes };
    this._dirty.clear();
  }

  _getCurrentTimestamp() {
    const config = this._getConfig();
    const timezone = this.constructor.timezone || config?.timezone || 'UTC';

    try {
      // Try to use moment-timezone if available
      const moment = require('moment-timezone');
      return moment().tz(timezone).toDate();
    } catch (e) {
      try {
        // Try to use date-fns-tz if available
        const { zonedTimeToUtc } = require('date-fns-tz');
        return zonedTimeToUtc(new Date(), timezone);
      } catch (e2) {
        // Fallback to simple but accurate method
        const now = new Date();
        if (timezone === 'UTC') return now;

        // Use toLocaleString for accurate timezone conversion
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const targetTime = new Date(utcTime + (this._getTimezoneOffset(timezone, now) * 60000));
        return targetTime;
      }
    }
  }

  _getTimezoneOffset(timezone, date) {
    try {
      const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
      const targetDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
      return (targetDate.getTime() - utcDate.getTime()) / 60000;
    } catch (e) {
      return 0; // Default to UTC
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

      if (this.constructor.timestamps) {
        const now = this._getCurrentTimestamp();
        this.setAttribute('created_at', now).setAttribute('updated_at', now);
      }

      // Generate UUID if needed
      if (!this.constructor.incrementing && this.constructor.keyType === 'string' && !this.getKey()) {
        this.setAttribute(this.constructor.primaryKey, this.constructor.generateUuid());
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
      // Updating existing record
      if (await this.constructor.fireEvent('updating', this) === false) return false;
      if (await this.constructor.fireEvent('saving', this) === false) return false;

      if (this.constructor.timestamps) {
        this.setAttribute('updated_at', this._getCurrentTimestamp());
      }

      const updateData = this.getDirty();
      delete updateData.created_at; // Never update created_at

      if (Object.keys(updateData).length > 0) {
        await this.constructor.query().where(this.constructor.primaryKey, this.getKey()).update(updateData);
      }

      await this.constructor.fireEvent('updated', this);
      await this.constructor.fireEvent('saved', this);
      this.syncOriginal();
    }

    return true;
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

    if (this.constructor.softDeletes) {
      this.setAttribute('deleted_at', new Date());
      await this.save();
    } else {
      await this.constructor.query().where(this.constructor.primaryKey, this.getKey()).delete();
      this.exists = false;
    }

    await this.constructor.fireEvent('deleted', this);
    return true;
  }

  async restore() {
    if (!this.constructor.softDeletes || !this.getAttribute('deleted_at')) {
      return false;
    }

    await this.constructor.fireEvent('restoring', this);

    this.setAttribute('deleted_at', null);
    await this.save();

    await this.constructor.fireEvent('restored', this);
    return true;
  }

  trashed() {
    return this.constructor.softDeletes && this.getAttribute('deleted_at') !== null;
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

  async forceDelete() {
    if (!this.exists) return false;

    await this.constructor.fireEvent('deleting', this);
    await this.constructor.query().where(this.constructor.primaryKey, this.getKey()).delete();
    this.exists = false;
    await this.constructor.fireEvent('deleted', this);
    return true;
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
    return new HasOne(this, relatedName, fk || `${this.constructor.table}_id`, lk || this.constructor.primaryKey);
  }
  hasMany(related, fk, lk) {
    const relatedName = this._resolveRelatedName(related);
    return new HasMany(this, relatedName, fk || `${this.constructor.table}_id`, lk || this.constructor.primaryKey);
  }
  belongsTo(related, fk, ok) {
    const relatedName = this._resolveRelatedName(related);
    return new BelongsTo(this, relatedName, fk, ok || this.constructor.primaryKey);
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
  morphMany(related, type, id) {
    const relatedName = typeof related === 'function' && related.name ? related.name : related;
    return new MorphMany(this, relatedName, type, id, this.constructor.name);
  }
}

module.exports = Model;
