import QueryBuilder, { PaginationResult, SimplePaginationResult, CursorPaginationResult } from './QueryBuilder';
import Collection from './Collection';
import { HasOne, HasMany, BelongsTo, BelongsToMany, HasManyThrough, MorphTo, MorphOne, MorphMany } from './Relation';

export interface ModelAttributes {
  [key: string]: any;
}

export interface CastInstance {
  get(value: any): any;
  set(value: any): any;
}

export interface ModelCasts {
  [key: string]: 'string' | 'number' | 'boolean' | 'date' | 'json' | 'array' | 'object' | 'float' | CastInstance;
}

export interface ModelEvents {
  [event: string]: Array<(model: any) => Promise<boolean | void> | boolean | void>;
}

export interface Observer {
  creating?(model: any): Promise<void> | void;
  created?(model: any): Promise<void> | void;
  updating?(model: any): Promise<void> | void;
  updated?(model: any): Promise<void> | void;
  saving?(model: any): Promise<void> | void;
  saved?(model: any): Promise<void> | void;
  deleting?(model: any): Promise<void> | void;
  deleted?(model: any): Promise<void> | void;
  restoring?(model: any): Promise<void> | void;
  restored?(model: any): Promise<void> | void;
}

export default class Model<TAttributes extends ModelAttributes = ModelAttributes> {
  // Static properties
  protected static table: string;
  protected static connection?: string;
  protected static primaryKey: string;
  protected static keyType: 'number' | 'string' | 'uuid' | 'ulid';
  protected static incrementing: boolean;
  protected static timestamps: boolean;
  protected static createdAt: string;
  protected static updatedAt: string;
  protected static softDeletes: boolean;
  protected static deletedAt: string;
  protected static fillable: string[];
  protected static guarded: string[];
  protected static casts: ModelCasts;
  protected static events: ModelEvents;
  protected static globalScopes: Map<string, (query: QueryBuilder) => void>;
  protected static appends: string[];
  protected static timezone: string;
  static strictLoading: boolean;
  static touches: string[];
  static enums: { [column: string]: string[] };
  static embeddingColumn: string;
  static embeddingDimensions: number;
  static embeddingProvider?: (text: string) => Promise<number[]>;

  // Instance properties
  attributes: ModelAttributes;
  original: ModelAttributes;
  relations: { [key: string]: any };
  exists: boolean;
  wasRecentlyCreated: boolean;
  protected _dirty: Set<string>;
  protected fillable: string[];
  protected guarded: string[];
  protected casts: ModelCasts;
  protected hidden?: string[];
  protected appends?: string[];
  protected _deferred?: ModelAttributes;

  constructor(attributes?: ModelAttributes);

  // Static methods
  static register(): void;
  static _autoRegister(): void;
  static resolveRelatedModel(related: string | typeof Model): typeof Model;
  static query(): QueryBuilder;
  static with(...relations: string[]): QueryBuilder;
  static withCount(...relations: string[]): QueryBuilder;
  static on(connectionOrTrx: string | any): QueryBuilder;
  static all(): Promise<Model[]>;
  static find(id: any): Promise<Model | null>;
  static findBy(column: string, value: any): Promise<Model | null>;
  static first(): Promise<Model | null>;
  static firstOrFail(): Promise<Model>;
  static latest(column?: string): QueryBuilder;
  static oldest(column?: string): QueryBuilder;
  static withTrashed(): QueryBuilder;
  static onlyTrashed(): QueryBuilder;
  static withoutTrashed(): QueryBuilder;
  static findOrFail(id: number | string): Promise<Model>;
  static insertGetId(data: { [key: string]: any }): Promise<number | string>;
  static upsert(data: any[], uniqueBy: string[], update?: string[]): Promise<any>;
  static withoutGlobalScopes(): QueryBuilder;
  static make(attributes?: ModelAttributes): Model;
  static create(attributes?: ModelAttributes): Promise<Model>;
  static generateUuid(): string;
  static generateUlid(): string;
  static _generateKey(): string;
  static withoutEvents<T>(callback: () => Promise<T>): Promise<T>;
  static prunable(): QueryBuilder;
  static prune(): Promise<number>;
  static insert(data: ModelAttributes | ModelAttributes[]): Promise<any>;
  static destroy(ids: any | any[]): Promise<number>;
  static truncate(): Promise<void>;
  static seed(count?: number): Promise<any[]>;
  static nearestTo(vector: number[], options?: { limit?: number; column?: string; distance?: 'cosine' | 'l2' | 'inner' }): Promise<Collection<any>>;
  static search(text: string, options?: { limit?: number; column?: string; distance?: 'cosine' | 'l2' | 'inner'; provider?: (text: string) => Promise<number[]> }): Promise<Collection<any>>;
  static firstOrCreate(attributes: ModelAttributes, values?: ModelAttributes): Promise<Model>;
  static firstOrNew(attributes: ModelAttributes, values?: ModelAttributes): Promise<Model>;
  static updateOrCreate(attributes: ModelAttributes, values?: ModelAttributes): Promise<Model>;

  // QueryBuilder methods forwarded from Model.query() — at runtime, any
  // QueryBuilder method not already declared above is proxied automatically
  // from Model.<method>() to Model.query().<method>() (see Model.js), so this
  // list exists purely to give TypeScript users type information for it.
  static where(column: string, value: any): QueryBuilder;
  static where(column: string, operator: string, value: any): QueryBuilder;
  static orWhere(column: string, value: any): QueryBuilder;
  static orWhere(column: string, operator: string, value: any): QueryBuilder;
  static whereIn(column: string, values: any[]): QueryBuilder;
  static whereNotIn(column: string, values: any[]): QueryBuilder;
  static whereNull(column: string): QueryBuilder;
  static whereNotNull(column: string): QueryBuilder;
  static whereBetween(column: string, range: [any, any]): QueryBuilder;
  static whereNotBetween(column: string, range: [any, any]): QueryBuilder;
  static whereJsonContains(column: string, value: any): QueryBuilder;
  static whereJsonLength(column: string, operator: string, value: number): QueryBuilder;
  static whereDate(column: string, value: string): QueryBuilder;
  static whereDate(column: string, operator: string, value: string): QueryBuilder;
  static whereMonth(column: string, month: number): QueryBuilder;
  static whereYear(column: string, year: number): QueryBuilder;
  static whereDay(column: string, operatorOrValue: any, value?: any): QueryBuilder;
  static whereTime(column: string, operatorOrValue: any, value?: any): QueryBuilder;
  static whereRaw(sql: string, bindings?: any[]): QueryBuilder;
  static orWhereNull(column: string): QueryBuilder;
  static orWhereNotNull(column: string): QueryBuilder;
  static orWhereIn(column: string, values: any[]): QueryBuilder;
  static orWhereNotIn(column: string, values: any[]): QueryBuilder;
  static orWhereRaw(sql: string, bindings?: any[]): QueryBuilder;
  static whereExists(callback: (query: QueryBuilder) => void): QueryBuilder;
  static whereNotExists(callback: (query: QueryBuilder) => void): QueryBuilder;
  static when<T>(condition: T, callback: (query: QueryBuilder, condition: T) => void, otherwise?: (query: QueryBuilder) => void): QueryBuilder;
  static unless<T>(condition: T, callback: (query: QueryBuilder) => void, otherwise?: (query: QueryBuilder, condition: T) => void): QueryBuilder;

  static join(table: string, first: string, operator: string, second: string): QueryBuilder;
  static leftJoin(table: string, first: string, operator: string, second: string): QueryBuilder;
  static rightJoin(table: string, first: string, operator: string, second: string): QueryBuilder;
  static innerJoin(table: string, first: string, operator: string, second: string): QueryBuilder;
  static crossJoin(table: string): QueryBuilder;

  static orderBy(column: string, direction?: 'asc' | 'desc'): QueryBuilder;
  static orderByRaw(sql: string): QueryBuilder;
  static orderBySubquery(callback: (query: QueryBuilder) => void, direction?: 'asc' | 'desc'): QueryBuilder;
  static inRandomOrder(): QueryBuilder;
  static limit(count: number): QueryBuilder;
  static offset(count: number): QueryBuilder;
  static take(count: number): QueryBuilder;
  static skip(count: number): QueryBuilder;
  static from(table: string): QueryBuilder;
  static forPage(page: number, perPage?: number): QueryBuilder;

  static groupBy(...columns: string[]): QueryBuilder;
  static having(column: string, operator: string, value: any): QueryBuilder;
  static having(rawSql: string): QueryBuilder;
  static havingRaw(sql: string, bindings?: any[]): QueryBuilder;

  static lockForUpdate(): QueryBuilder;
  static sharedLock(): QueryBuilder;
  static skipLocked(): QueryBuilder;
  static noWait(): QueryBuilder;

  static select(...columns: any[]): QueryBuilder;
  static addSelect(...columns: any[]): QueryBuilder;
  static addSelect(subqueries: { [alias: string]: (query: QueryBuilder) => void }): QueryBuilder;
  static distinct(): QueryBuilder;
  static selectRaw(sql: string, bindings?: any[]): QueryBuilder;

  static withPendingAttributes(attributes: { [key: string]: any }): QueryBuilder;
  static withConstraints(relation: string, callback: (query: QueryBuilder) => void): QueryBuilder;
  static withConstraints(relations: { [key: string]: (query: QueryBuilder) => void }): QueryBuilder;
  static whereHas(relation: string, callback?: (query: QueryBuilder) => void): QueryBuilder;
  static doesntHave(relation: string): QueryBuilder;
  static whereDoesntHave(relation: string, callback?: (query: QueryBuilder) => void): QueryBuilder;
  static has(relation: string, operator?: '=' | '!=' | '<' | '<=' | '>' | '>=', count?: number): QueryBuilder;

  static count(column?: string): Promise<number>;
  static sum(column: string): Promise<number>;
  static avg(column: string): Promise<number>;
  static min(column: string): Promise<any>;
  static max(column: string): Promise<any>;

  static pluck(column: string): Promise<any[]>;
  static exists(): Promise<boolean>;
  static doesntExist(): Promise<boolean>;
  static sole(): Promise<Model>;
  static tap(callback: (query: QueryBuilder) => void): QueryBuilder;
  static get(): Promise<Collection<Model>>;

  static paginate(page?: number, perPage?: number): Promise<PaginationResult<Model>>;
  static simplePaginate(page?: number, perPage?: number): Promise<SimplePaginationResult<Model>>;
  static cursorPaginate(perPage?: number, cursor?: string, column?: string, direction?: 'asc' | 'desc'): Promise<CursorPaginationResult<Model>>;

  static chunk(size: number, callback: (models: Collection<Model>) => Promise<void>): Promise<void>;
  static cursor(chunkSize?: number): AsyncGenerator<Model, void, unknown>;
  static lazy(chunkSize?: number): AsyncGenerator<Model, void, unknown>;

  static update(data: any): Promise<number>;
  static increment(column: string, amount?: number): Promise<number>;
  static decrement(column: string, amount?: number): Promise<number>;
  static delete(): Promise<number>;
  static restore(): Promise<number>;

  static clone(): QueryBuilder;
  static toKnex(): any;
  static toSql(): string;
  static values(): Promise<any[]>;
  static new(attributes?: { [key: string]: any }): Promise<Model>;

  // Scopes
  static addGlobalScope(name: string, scope: (query: QueryBuilder) => void): void;
  static removeGlobalScope(name: string): void;
  static withoutGlobalScope(name: string): QueryBuilder;
  static applyGlobalScopes(query: QueryBuilder): void;

  // Events
  static creating(callback: (model: Model) => Promise<boolean | void> | boolean | void): void;
  static created(callback: (model: Model) => Promise<boolean | void> | boolean | void): void;
  static updating(callback: (model: Model) => Promise<boolean | void> | boolean | void): void;
  static updated(callback: (model: Model) => Promise<boolean | void> | boolean | void): void;
  static saving(callback: (model: Model) => Promise<boolean | void> | boolean | void): void;
  static saved(callback: (model: Model) => Promise<boolean | void> | boolean | void): void;
  static deleting(callback: (model: Model) => Promise<boolean | void> | boolean | void): void;
  static deleted(callback: (model: Model) => Promise<boolean | void> | boolean | void): void;
  static restoring(callback: (model: Model) => Promise<boolean | void> | boolean | void): void;
  static restored(callback: (model: Model) => Promise<boolean | void> | boolean | void): void;
  static observe(observer: Observer | (new () => Observer)): void;
  static fireEvent(event: string, model: Model): Promise<boolean>;

  // Table info
  protected static getTableName(): string;
  protected static getPrimaryKey(): string;
  protected static getKeyType(): string;
  protected static getIncrementing(): boolean;
  protected static getConnectionName(): string | undefined;

  // Instance methods
  getKey(): any;
  fill(attributes: ModelAttributes): this;
  forceFill(attributes: ModelAttributes): this;
  load(...relations: string[]): Promise<this>;
  loadMissing(...relations: string[]): Promise<this>;
  getRelation(key: string): any;
  relationLoaded(key: string): boolean;
  makeHidden(keys: string | string[]): this;
  makeVisible(keys: string | string[]): this;
  append(keys: string | string[]): this;
  isFillable(key: string): boolean;
  getAttribute(key: string): any;
  setAttribute(key: string, value: any): this;
  syncOriginal(): void;
  getOriginal(key: string): any;
  getOriginal(): ModelAttributes;
  save(): Promise<boolean>;
  update(attributes?: ModelAttributes): Promise<boolean>;
  isDirty(key?: string): boolean;
  getDirty(): ModelAttributes;
  delete(): Promise<boolean>;
  restore(): Promise<boolean>;
  increment(column: string, amount?: number): Promise<this>;
  decrement(column: string, amount?: number): Promise<this>;
  trashed(): boolean;
  only(keys: string[]): ModelAttributes;
  except(keys: string[]): ModelAttributes;
  forceDelete(): Promise<boolean>;
  fresh(): Promise<this | null>;
  is(other: Model): boolean;
  isNot(other: Model | null | undefined): boolean;
  replicate(except?: string[]): this;
  toJSON(): any;

  // Relationships
  hasOne(related: string | typeof Model, foreignKey?: string, localKey?: string): HasOne;
  hasMany(related: string | typeof Model, foreignKey?: string, localKey?: string): HasMany;
  belongsTo(related: string | typeof Model, foreignKey?: string, ownerKey?: string): BelongsTo;
  belongsToMany(
    related: string | typeof Model,
    pivotTable?: string,
    foreignPivotKey?: string,
    relatedPivotKey?: string,
    parentKey?: string,
    relatedKey?: string
  ): BelongsToMany;
  hasManyThrough(
    related: string | typeof Model,
    through: string | typeof Model,
    firstKey?: string,
    secondKey?: string,
    localKey?: string,
    secondLocalKey?: string
  ): HasManyThrough;
  morphTo(typeColumn?: string, idColumn?: string): MorphTo;
  morphOne(related: string | typeof Model, typeColumn?: string, idColumn?: string): MorphOne;
  morphMany(related: string | typeof Model, typeColumn?: string, idColumn?: string): MorphMany;

  // Protected methods
  protected _initialize(): void;
  protected _createAttributeGetters(): void;
  protected _getCurrentTimestamp(): Date;
  protected _getTimezoneOffset(timezone: string, date: Date): number;
  protected _getConfig(): any;
  protected _resolveRelatedName(related: string | typeof Model): string;
}