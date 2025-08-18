import QueryBuilder from './QueryBuilder';
import { HasOne, HasMany, BelongsTo, BelongsToMany, HasManyThrough, MorphTo, MorphMany } from './Relation';

export interface ModelAttributes {
  [key: string]: any;
}

export interface ModelCasts {
  [key: string]: 'string' | 'number' | 'boolean' | 'date' | 'json' | 'array' | 'object' | 'float';
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

export default class Model {
  // Static properties
  protected static table: string;
  protected static connection?: string;
  protected static primaryKey: string;
  protected static keyType: 'number' | 'string';
  protected static incrementing: boolean;
  protected static timestamps: boolean;
  protected static softDeletes: boolean;
  protected static fillable: string[];
  protected static guarded: string[];
  protected static casts: ModelCasts;
  protected static events: ModelEvents;
  protected static globalScopes: Map<string, (query: QueryBuilder) => void>;
  protected static appends: string[];
  protected static timezone: string;

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
  static resolveRelatedModel(related: string | typeof Model): typeof Model;
  static query(): QueryBuilder;
  static with(...relations: string[]): QueryBuilder;
  static on(connectionOrTrx: string | any): QueryBuilder;
  static all(): Promise<Model[]>;
  static find(id: any): Promise<Model | null>;
  static findBy(column: string, value: any): Promise<Model | null>;
  static first(): Promise<Model | null>;
  static firstOrFail(): Promise<Model>;
  static latest(column?: string): QueryBuilder;
  static oldest(column?: string): QueryBuilder;
  static make(attributes?: ModelAttributes): Model;
  static create(attributes?: ModelAttributes): Promise<Model>;
  static generateUuid(): string;
  static insert(data: ModelAttributes | ModelAttributes[]): Promise<any>;
  static destroy(ids: any | any[]): Promise<number>;
  static firstOrCreate(attributes: ModelAttributes, values?: ModelAttributes): Promise<Model>;
  static firstOrNew(attributes: ModelAttributes, values?: ModelAttributes): Promise<Model>;
  static updateOrCreate(attributes: ModelAttributes, values?: ModelAttributes): Promise<Model>;

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
  isFillable(key: string): boolean;
  getAttribute(key: string): any;
  setAttribute(key: string, value: any): this;
  syncOriginal(): void;
  save(): Promise<boolean>;
  update(attributes?: ModelAttributes): Promise<boolean>;
  isDirty(key?: string): boolean;
  getDirty(): ModelAttributes;
  delete(): Promise<boolean>;
  restore(): Promise<boolean>;
  trashed(): boolean;
  only(keys: string[]): ModelAttributes;
  except(keys: string[]): ModelAttributes;
  forceDelete(): Promise<boolean>;
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
  morphMany(related: string | typeof Model, typeColumn?: string, idColumn?: string): MorphMany;

  // Protected methods
  protected _initialize(): void;
  protected _createAttributeGetters(): void;
  protected _getCurrentTimestamp(): Date;
  protected _getTimezoneOffset(timezone: string, date: Date): number;
  protected _getConfig(): any;
  protected _resolveRelatedName(related: string | typeof Model): string;
}