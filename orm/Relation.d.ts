import QueryBuilder from './QueryBuilder';
import Model from './Model';
import Collection from './Collection';

export class Relation {
  protected parent: Model;
  protected related: string | typeof Model;
  protected foreignKey: string;
  protected localKey: string;

  constructor(parent: Model, related: string | typeof Model, foreignKey: string, localKey?: string);

  getRelatedClass(): typeof Model;
  newQuery(): QueryBuilder;
}

export class HasOne extends Relation {
  addConstraints(): void;
  getResults(): Promise<Model | null>;
}

export class HasMany extends Relation {
  addConstraints(): void;
  getResults(): Promise<Collection<Model>>;
}

export class BelongsTo extends Relation {
  addConstraints(): void;
  getResults(): Promise<Model | null>;
}

export class BelongsToMany extends Relation {
  protected pivotTable: string;
  protected parentPivotKey: string;
  protected relatedPivotKey: string;
  protected parentKey: string;
  protected relatedKey: string;
  protected pivotColumns: string[];
  protected pivotTimestamps: boolean;

  constructor(
    parent: Model,
    related: string | typeof Model,
    pivotTable?: string,
    foreignPivotKey?: string,
    relatedPivotKey?: string,
    parentKey?: string,
    relatedKey?: string
  );

  withPivot(...columns: string[]): this;
  withTimestamps(): this;
  addConstraints(): void;
  getResults(): Promise<Model[]>;
  attach(id: any, attributes?: any): Promise<void>;
  detach(id?: any): Promise<number>;
  sync(ids: any[]): Promise<void>;
}

export class HasManyThrough extends Relation {
  protected through: string | typeof Model;
  protected firstKey: string;
  protected secondKey: string;
  protected secondLocalKey: string;

  constructor(
    parent: Model,
    related: string | typeof Model,
    through: string | typeof Model,
    firstKey?: string,
    secondKey?: string,
    localKey?: string,
    secondLocalKey?: string
  );

  addConstraints(): void;
  getResults(): Promise<Collection<Model>>;
}

export class MorphTo extends Relation {
  protected morphType: string;
  protected morphId: string;

  constructor(parent: Model, morphType: string, morphId: string);

  addConstraints(): void;
  getResults(): Promise<Model | null>;
}

export class MorphMany extends Relation {
  protected morphType: string;
  protected morphId: string;
  protected morphClass: string;

  constructor(parent: Model, related: string | typeof Model, morphType: string, morphId: string, morphClass: string);

  addConstraints(): void;
  getResults(): Promise<Collection<Model>>;
}