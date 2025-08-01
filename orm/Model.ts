import QueryBuilder from './QueryBuilder';
import { HasOne, HasMany, BelongsTo, BelongsToMany, HasManyThrough, MorphTo, MorphMany } from './Relation';
import Database from '../database/connection';
import ModelRegistry from './ModelRegistry';

// Auto-load configuration on first import
(function autoLoadConfig() {
  const fs = require('fs');
  const path = require('path');
  const configPath = path.join(process.cwd(), 'ilana.config.js');
  if (fs.existsSync(configPath)) {
    delete require.cache[configPath];
    require(configPath); // Config file handles Database.configure()
  }
})();

export interface ModelEvents {
  creating?: (model: Model) => Promise<void> | void;
  created?: (model: Model) => Promise<void> | void;
  updating?: (model: Model) => Promise<void> | void;
  updated?: (model: Model) => Promise<void> | void;
  saving?: (model: Model) => Promise<void> | void;
  saved?: (model: Model) => Promise<void> | void;
  deleting?: (model: Model) => Promise<void> | void;
  deleted?: (model: Model) => Promise<void> | void;
  restoring?: (model: Model) => Promise<void> | void;
  restored?: (model: Model) => Promise<void> | void;
}

export type CastType = 'string' | 'number' | 'boolean' | 'date' | 'json' | 'array' | CustomCast;

export interface CustomCast {
  get(value: any, attributes?: any): any;
  set(value: any, attributes?: any): any;
}

export abstract class Model {
  protected static table: string;
  protected static connection?: string;
  protected static primaryKey: string = 'id';
  protected static keyType: 'int' | 'string' = 'int';
  protected static incrementing: boolean = true;
  protected static timestamps: boolean = true;
  protected static softDeletes: boolean = false;
  protected static events: ModelEvents = {};
  protected static globalScopes: Map<string, (query: QueryBuilder) => void> = new Map();
  
  protected attributes: Record<string, any> = {};
  protected original: Record<string, any> = {};
  protected relations: Record<string, any> = {};
  protected exists: boolean = false;
  protected wasRecentlyCreated: boolean = false;

  // Define these in subclasses
  protected fillable: string[] = [];
  protected guarded: string[] = ['*'];
  protected hidden: string[] = [];
  protected visible: string[] = [];
  protected appends: string[] = [];
  protected casts: Record<string, CastType> = {};
  protected dates: string[] = ['created_at', 'updated_at', 'deleted_at'];

  constructor(attributes: Record<string, any> = {}) {
    this.fill(attributes);
    this.syncOriginal();
  }

  // Static methods
  static getTableName(): string {
    return this.table || this.name.toLowerCase() + 's';
  }

  static getPrimaryKey(): string {
    return this.primaryKey;
  }

  static getKeyType(): 'int' | 'string' {
    return this.keyType;
  }

  static getIncrementing(): boolean {
    return this.incrementing;
  }

  static getConnectionName(): string | undefined {
    return this.connection;
  }

  // Auto-register model for polymorphic relationships
  static register(): void {
    ModelRegistry.register(this.name, this as any);
  }

  static query<T extends Model>(): QueryBuilder<T> {
    const query = new QueryBuilder<T>(this.getTableName(), this, this.getConnectionName());
    this.applyGlobalScopes(query);
    return query;
  }

  static async all<T extends Model>(): Promise<T[]> {
    return this.query<T>().get();
  }

  static async find<T extends Model>(id: any): Promise<T | null> {
    return this.query<T>().find(id);
  }

  static async findOrFail<T extends Model>(id: any): Promise<T> {
    return this.query<T>().findOrFail(id);
  }

  static async first<T extends Model>(): Promise<T | null> {
    return this.query<T>().first();
  }

  static latest<T extends Model>(column: string = 'created_at'): QueryBuilder<T> {
    return this.query<T>().latest(column);
  }

  static oldest<T extends Model>(column: string = 'created_at'): QueryBuilder<T> {
    return this.query<T>().oldest(column);
  }

  static async create<T extends Model>(attributes: Record<string, any>): Promise<T> {
    const instance = new (this as any)(attributes) as T;
    
    // Generate UUID if using string keys and not incrementing
    if (!this.getIncrementing() && this.getKeyType() === 'string' && !attributes[this.getPrimaryKey()]) {
      instance.setAttribute(this.getPrimaryKey(), this.generateUuid());
    }
    
    await instance.save();
    return instance;
  }

  private static generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  static async insert(data: any[]): Promise<any> {
    return this.query().insert(data);
  }

  static async insertGetId(data: any): Promise<number> {
    return this.query().insertGetId(data);
  }

  static async destroy(ids: any | any[]): Promise<number> {
    const idsArray = Array.isArray(ids) ? ids : [ids];
    return this.query().whereIn(this.getPrimaryKey(), idsArray).delete();
  }

  static async firstOrCreate<T extends Model>(attributes: Record<string, any>, values: Record<string, any> = {}): Promise<T> {
    const instance = await this.query<T>().where(attributes).first();
    if (instance) {
      return instance;
    }
    return this.create<T>({ ...attributes, ...values });
  }

  static async updateOrCreate<T extends Model>(attributes: Record<string, any>, values: Record<string, any> = {}): Promise<T> {
    const instance = await this.query<T>().where(attributes).first();
    if (instance) {
      await instance.update({ ...values });
      return instance;
    }
    return this.create<T>({ ...attributes, ...values });
  }

  static async firstOrNew<T extends Model>(attributes: Record<string, any>, values: Record<string, any> = {}): Promise<T> {
    const instance = await this.query<T>().where(attributes).first();
    if (instance) {
      return instance;
    }
    return new (this as any)({ ...attributes, ...values }) as T;
  }

  static async upsert(data: any[], uniqueBy: string[], update?: string[]): Promise<any> {
    return this.query().upsert(data, uniqueBy, update);
  }

  // Soft deletes
  static withTrashed<T extends Model>(): QueryBuilder<T> {
    const query = new QueryBuilder<T>(this.getTableName(), this, this.getConnectionName());
    // Don't apply soft delete scope
    return query;
  }

  static onlyTrashed<T extends Model>(): QueryBuilder<T> {
    const query = new QueryBuilder<T>(this.getTableName(), this, this.getConnectionName());
    return query.whereNotNull('deleted_at');
  }

  static withoutTrashed<T extends Model>(): QueryBuilder<T> {
    const query = new QueryBuilder<T>(this.getTableName(), this, this.getConnectionName());
    if (this.softDeletes) {
      query.whereNull('deleted_at');
    }
    return query;
  }

  // Scopes
  static addGlobalScope(name: string, scope: (query: QueryBuilder) => void): void {
    this.globalScopes.set(name, scope);
  }

  static removeGlobalScope(name: string): void {
    this.globalScopes.delete(name);
  }

  static withoutGlobalScope<T extends Model>(name: string): QueryBuilder<T> {
    const query = new QueryBuilder<T>(this.getTableName(), this);
    // Apply all scopes except the specified one
    for (const [scopeName, scope] of this.globalScopes) {
      if (scopeName !== name) {
        scope(query);
      }
    }
    return query;
  }

  private static applyGlobalScopes(query: QueryBuilder): void {
    for (const scope of this.globalScopes.values()) {
      scope(query);
    }
  }

  // Events
  static observe(events: ModelEvents | (new () => any)): void {
    if (typeof events === 'function') {
      // Observer class
      const observer = new events();
      const observerEvents: ModelEvents = {};
      
      // Map observer methods to events
      const eventMethods = ['creating', 'created', 'updating', 'updated', 'saving', 'saved', 'deleting', 'deleted', 'restoring', 'restored'];
      for (const method of eventMethods) {
        if (typeof observer[method] === 'function') {
          observerEvents[method as keyof ModelEvents] = observer[method].bind(observer);
        }
      }
      
      this.events = { ...this.events, ...observerEvents };
    } else {
      this.events = { ...this.events, ...events };
    }
  }

  private static async fireEvent(event: keyof ModelEvents, model: Model): Promise<void> {
    const handler = this.events[event];
    if (handler) {
      await handler(model);
    }
  }

  // Individual event listeners
  static creating(callback: (model: Model) => Promise<void> | void): void {
    this.events.creating = callback;
  }

  static created(callback: (model: Model) => Promise<void> | void): void {
    this.events.created = callback;
  }

  static updating(callback: (model: Model) => Promise<void> | void): void {
    this.events.updating = callback;
  }

  static updated(callback: (model: Model) => Promise<void> | void): void {
    this.events.updated = callback;
  }

  static saving(callback: (model: Model) => Promise<void> | void): void {
    this.events.saving = callback;
  }

  static saved(callback: (model: Model) => Promise<void> | void): void {
    this.events.saved = callback;
  }

  static deleting(callback: (model: Model) => Promise<void> | void): void {
    this.events.deleting = callback;
  }

  static deleted(callback: (model: Model) => Promise<void> | void): void {
    this.events.deleted = callback;
  }

  // Eager loading
  static with<T extends Model>(...relations: string[]): QueryBuilder<T> {
    const query = this.query<T>();
    query.with(...relations);
    return query;
  }

  async load(...relations: string[]): Promise<this> {
    for (const relation of relations) {
      const relationMethod = (this as any)[relation];
      if (typeof relationMethod === 'function') {
        const relationInstance = relationMethod.call(this);
        this.relations[relation] = await relationInstance.getResults();
      }
    }
    return this;
  }

  async loadMissing(...relations: string[]): Promise<this> {
    const missing = relations.filter(relation => !(relation in this.relations));
    if (missing.length > 0) {
      await this.load(...missing);
    }
    return this;
  }

  getRelation(key: string): any {
    return this.relations[key];
  }

  relationLoaded(key: string): boolean {
    return key in this.relations;
  }

  // Instance methods
  fill(attributes: Record<string, any>): this {
    for (const [key, value] of Object.entries(attributes)) {
      if (this.isFillable(key)) {
        this.setAttribute(key, value);
      }
    }
    return this;
  }

  private isFillable(key: string): boolean {
    if (this.fillable.length > 0) {
      return this.fillable.includes(key);
    }
    return !this.guarded.includes(key) && !this.guarded.includes('*');
  }

  getAttribute(key: string): any {
    if (this.hasGetMutator(key)) {
      return this.mutateAttribute(key, this.attributes[key]);
    }

    if (this.hasCast(key)) {
      return this.castAttribute(key, this.attributes[key]);
    }

    return this.attributes[key];
  }

  setAttribute(key: string, value: any): this {
    if (this.hasSetMutator(key)) {
      value = this.mutateAttributeForArray(key, value);
    }

    // Handle custom casts for setting
    if (this.hasCast(key)) {
      const castType = this.casts[key];
      if (typeof castType === 'object' && castType.set) {
        value = castType.set(value, this.attributes);
      }
    }

    this.attributes[key] = value;
    return this;
  }

  private hasGetMutator(key: string): boolean {
    return typeof (this as any)[`get${this.studly(key)}Attribute`] === 'function';
  }

  private hasSetMutator(key: string): boolean {
    return typeof (this as any)[`set${this.studly(key)}Attribute`] === 'function';
  }

  private mutateAttribute(key: string, value: any): any {
    return (this as any)[`get${this.studly(key)}Attribute`](value);
  }

  private mutateAttributeForArray(key: string, value: any): any {
    return (this as any)[`set${this.studly(key)}Attribute`](value);
  }

  private studly(str: string): string {
    return str.replace(/_(.)/g, (_, char) => char.toUpperCase())
              .replace(/^(.)/, char => char.toUpperCase());
  }

  private hasCast(key: string): boolean {
    return key in this.casts;
  }

  private castAttribute(key: string, value: any): any {
    if (value === null) return null;

    const castType = this.casts[key];
    
    // Handle custom casts
    if (typeof castType === 'object' && castType.get) {
      return castType.get(value, this.attributes);
    }
    
    switch (castType) {
      case 'string':
        return String(value);
      case 'number':
        return Number(value);
      case 'boolean':
        return Boolean(value);
      case 'date':
        return new Date(value);
      case 'json':
        return typeof value === 'string' ? JSON.parse(value) : value;
      case 'array':
        return Array.isArray(value) ? value : JSON.parse(value);
      default:
        return value;
    }
  }

  async save(): Promise<boolean> {
    const query = this.newQueryWithoutScopes();

    if (this.exists) {
      await (this.constructor as typeof Model).fireEvent('updating', this);
      await (this.constructor as typeof Model).fireEvent('saving', this);

      if (this.isDirty()) {
        if ((this.constructor as typeof Model).timestamps) {
          this.setAttribute('updated_at', new Date());
        }

        const affected = await query
          .where((this.constructor as typeof Model).getPrimaryKey(), this.getKey())
          .update(this.getDirty());

        if (affected > 0) {
          await (this.constructor as typeof Model).fireEvent('updated', this);
          await (this.constructor as typeof Model).fireEvent('saved', this);
          this.syncOriginal();
        }
      }
    } else {
      await (this.constructor as typeof Model).fireEvent('creating', this);
      await (this.constructor as typeof Model).fireEvent('saving', this);

      if ((this.constructor as typeof Model).timestamps) {
        const now = new Date();
        this.setAttribute('created_at', now);
        this.setAttribute('updated_at', now);
      }

      // Generate UUID if needed
      if (!(this.constructor as typeof Model).getIncrementing() && 
          (this.constructor as typeof Model).getKeyType() === 'string' && 
          !this.getKey()) {
        this.setAttribute((this.constructor as typeof Model).getPrimaryKey(), (this.constructor as typeof Model).generateUuid());
      }

      if ((this.constructor as typeof Model).getIncrementing()) {
        const id = await query.insertGetId(this.attributes);
        this.setAttribute((this.constructor as typeof Model).getPrimaryKey(), id);
      } else {
        await query.insert(this.attributes);
      }
      this.exists = true;
      this.wasRecentlyCreated = true;

      await (this.constructor as typeof Model).fireEvent('created', this);
      await (this.constructor as typeof Model).fireEvent('saved', this);
      this.syncOriginal();
    }

    return true;
  }

  async update(attributes: Record<string, any>): Promise<boolean> {
    this.fill(attributes);
    return this.save();
  }

  async delete(): Promise<boolean> {
    if (!this.exists) {
      return false;
    }

    await (this.constructor as typeof Model).fireEvent('deleting', this);

    if ((this.constructor as typeof Model).softDeletes) {
      this.setAttribute('deleted_at', new Date());
      await this.save();
    } else {
      const query = this.newQueryWithoutScopes();
      await query.where((this.constructor as typeof Model).getPrimaryKey(), this.getKey()).delete();
      this.exists = false;
    }

    await (this.constructor as typeof Model).fireEvent('deleted', this);
    return true;
  }

  async forceDelete(): Promise<boolean> {
    if (!this.exists) {
      return false;
    }

    await (this.constructor as typeof Model).fireEvent('deleting', this);

    const query = this.newQueryWithoutScopes();
    await query.where((this.constructor as typeof Model).getPrimaryKey(), this.getKey()).delete();
    this.exists = false;

    await (this.constructor as typeof Model).fireEvent('deleted', this);
    return true;
  }

  async restore(): Promise<boolean> {
    if (!(this.constructor as typeof Model).softDeletes) {
      return false;
    }

    await (this.constructor as typeof Model).fireEvent('restoring', this);

    this.setAttribute('deleted_at', null);
    await this.save();

    await (this.constructor as typeof Model).fireEvent('restored', this);
    return true;
  }

  getKey(): any {
    return this.getAttribute((this.constructor as typeof Model).getPrimaryKey());
  }

  private newQueryWithoutScopes(): QueryBuilder {
    const modelClass = this.constructor as typeof Model;
    return new QueryBuilder(modelClass.getTableName(), modelClass, modelClass.getConnectionName());
  }

  private isDirty(): boolean {
    return Object.keys(this.getDirty()).length > 0;
  }

  private getDirty(): Record<string, any> {
    const dirty: Record<string, any> = {};
    for (const [key, value] of Object.entries(this.attributes)) {
      if (this.original[key] !== value) {
        dirty[key] = value;
      }
    }
    return dirty;
  }

  private syncOriginal(): void {
    this.original = { ...this.attributes };
  }

  // Relationships
  hasOne<T extends Model>(related: new () => T, foreignKey?: string, localKey?: string): HasOne<T> {
    const relatedInstance = new related();
    const fk = foreignKey || `${(this.constructor as typeof Model).getTableName().slice(0, -1)}_id`;
    const lk = localKey || (this.constructor as typeof Model).getPrimaryKey();
    return new HasOne(this, related as any, fk, lk);
  }

  hasMany<T extends Model>(related: new () => T, foreignKey?: string, localKey?: string): HasMany<T> {
    const relatedInstance = new related();
    const fk = foreignKey || `${(this.constructor as typeof Model).getTableName().slice(0, -1)}_id`;
    const lk = localKey || (this.constructor as typeof Model).getPrimaryKey();
    return new HasMany(this, related as any, fk, lk);
  }

  belongsTo<T extends Model>(related: new () => T, foreignKey?: string, ownerKey?: string): BelongsTo<T> {
    const relatedInstance = new related();
    const fk = foreignKey || `${(related as any).getTableName().slice(0, -1)}_id`;
    const ok = ownerKey || (related as any).getPrimaryKey();
    return new BelongsTo(this, related as any, fk, ok);
  }

  belongsToMany<T extends Model>(
    related: new () => T,
    pivotTable?: string,
    foreignPivotKey?: string,
    relatedPivotKey?: string,
    parentKey?: string,
    relatedKey?: string
  ): BelongsToMany<T> {
    const relatedInstance = new related();
    const pivot = pivotTable || [
      (this.constructor as typeof Model).getTableName(),
      (related as any).getTableName()
    ].sort().join('_');
    
    const fpk = foreignPivotKey || `${(this.constructor as typeof Model).getTableName().slice(0, -1)}_id`;
    const rpk = relatedPivotKey || `${(related as any).getTableName().slice(0, -1)}_id`;
    const pk = parentKey || (this.constructor as typeof Model).getPrimaryKey();
    const rk = relatedKey || (related as any).getPrimaryKey();

    return new BelongsToMany(this, related as any, pivot, fpk, rpk, pk, rk);
  }

  hasManyThrough<T extends Model>(
    related: new () => T,
    through: new () => Model,
    firstKey?: string,
    secondKey?: string,
    localKey?: string,
    secondLocalKey?: string
  ): HasManyThrough<T> {
    const fk = firstKey || `${(this.constructor as typeof Model).getTableName().slice(0, -1)}_id`;
    const sk = secondKey || `${(through as any).getTableName().slice(0, -1)}_id`;
    const lk = localKey || (this.constructor as typeof Model).getPrimaryKey();
    const slk = secondLocalKey || (through as any).getPrimaryKey();

    return new HasManyThrough(this, related as any, through as any, fk, sk, lk, slk);
  }

  morphTo(morphType: string, morphId: string): MorphTo {
    return new MorphTo(this, morphType, morphId);
  }

  morphMany<T extends Model>(related: new () => T, morphType: string, morphId: string): MorphMany<T> {
    const morphClass = (this.constructor as typeof Model).name;
    return new MorphMany(this, related as any, morphType, morphId, morphClass);
  }

  // Serialization
  makeHidden(attributes: string[]): this {
    this.hidden.push(...attributes);
    return this;
  }

  makeVisible(attributes: string[]): this {
    this.visible.push(...attributes);
    return this;
  }

  append(attributes: string[]): this {
    this.appends.push(...attributes);
    return this;
  }

  toArray(): Record<string, any> {
    return this.toJSON();
  }

  toJSON(): Record<string, any> {
    const attributes = { ...this.attributes };
    
    // Apply hidden/visible
    if (this.visible.length > 0) {
      for (const key of Object.keys(attributes)) {
        if (!this.visible.includes(key)) {
          delete attributes[key];
        }
      }
    } else {
      for (const key of this.hidden) {
        delete attributes[key];
      }
    }

    // Add appends
    for (const key of this.appends) {
      attributes[key] = this.getAttribute(key);
    }

    // Add relations
    for (const [key, value] of Object.entries(this.relations)) {
      if (Array.isArray(value)) {
        attributes[key] = value.map(item => item.toJSON ? item.toJSON() : item);
      } else if (value && typeof value.toJSON === 'function') {
        attributes[key] = value.toJSON();
      } else {
        attributes[key] = value;
      }
    }

    return attributes;
  }

  // Check if model is soft deleted
  trashed(): boolean {
    return this.getAttribute('deleted_at') !== null;
  }

  // Check if attribute has changed
  isDirty(attribute?: string): boolean {
    if (attribute) {
      return this.original[attribute] !== this.attributes[attribute];
    }
    return Object.keys(this.getDirty()).length > 0;
  }

  // Get changed attributes
  getDirty(): Record<string, any> {
    const dirty: Record<string, any> = {};
    for (const [key, value] of Object.entries(this.attributes)) {
      if (this.original[key] !== value) {
        dirty[key] = value;
      }
    }
    return dirty;
  }

  // Get original attribute value
  getOriginal(key?: string): any {
    return key ? this.original[key] : this.original;
  }
}

export default Model;