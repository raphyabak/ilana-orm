import QueryBuilder from './QueryBuilder';
import Model from './Model';
import ModelRegistry from './ModelRegistry';

export abstract class Relation<T = any> {
  protected parent: Model;
  protected related: typeof Model;
  protected foreignKey: string;
  protected localKey: string;

  constructor(parent: Model, related: typeof Model, foreignKey: string, localKey: string = 'id') {
    this.parent = parent;
    this.related = related;
    this.foreignKey = foreignKey;
    this.localKey = localKey;
  }

  abstract getResults(): Promise<T>;
  abstract addConstraints(): void;

  newQuery(): QueryBuilder<T> {
    return new QueryBuilder(this.related.getTableName(), this.related);
  }
}

export class HasOne<T = any> extends Relation<T> {
  addConstraints(): void {
    // Constraints added when executing query
  }

  async getResults(): Promise<T | null> {
    return this.newQuery()
      .where(this.foreignKey, this.parent.getAttribute(this.localKey))
      .first();
  }
}

export class HasMany<T = any> extends Relation<T[]> {
  addConstraints(): void {
    // Constraints added when executing query
  }

  async getResults(): Promise<T[]> {
    return this.newQuery()
      .where(this.foreignKey, this.parent.getAttribute(this.localKey))
      .get();
  }
}

export class BelongsTo<T = any> extends Relation<T> {
  addConstraints(): void {
    // Constraints added when executing query
  }

  async getResults(): Promise<T | null> {
    return this.newQuery()
      .where(this.localKey, this.parent.getAttribute(this.foreignKey))
      .first();
  }
}

export class BelongsToMany<T = any> extends Relation<T[]> {
  protected pivotTable: string;
  protected relatedPivotKey: string;
  protected parentPivotKey: string;
  protected pivotColumns: string[] = [];
  protected pivotTimestamps: boolean = false;

  constructor(
    parent: Model,
    related: typeof Model,
    pivotTable: string,
    foreignPivotKey: string,
    relatedPivotKey: string,
    parentKey: string = 'id',
    relatedKey: string = 'id'
  ) {
    super(parent, related, relatedKey, parentKey);
    this.pivotTable = pivotTable;
    this.parentPivotKey = foreignPivotKey;
    this.relatedPivotKey = relatedPivotKey;
  }

  withPivot(...columns: string[]): this {
    this.pivotColumns.push(...columns);
    return this;
  }

  withTimestamps(): this {
    this.pivotTimestamps = true;
    this.pivotColumns.push('created_at', 'updated_at');
    return this;
  }

  addConstraints(): void {
    // Constraints added when executing query
  }

  async getResults(): Promise<T[]> {
    const selectColumns = [`${this.related.getTableName()}.*`];
    
    // Add pivot columns
    if (this.pivotColumns.length > 0) {
      for (const column of this.pivotColumns) {
        selectColumns.push(`${this.pivotTable}.${column} as pivot_${column}`);
      }
    }
    
    const query = this.newQuery()
      .select(...selectColumns)
      .join(this.pivotTable, `${this.related.getTableName()}.${this.foreignKey}`, `${this.pivotTable}.${this.relatedPivotKey}`)
      .where(`${this.pivotTable}.${this.parentPivotKey}`, this.parent.getAttribute(this.localKey));

    const results = await query.get();
    
    // Add pivot data to models
    return results.map((model: any) => {
      const pivotData: any = {};
      for (const column of this.pivotColumns) {
        if (model.attributes[`pivot_${column}`] !== undefined) {
          pivotData[column] = model.attributes[`pivot_${column}`];
          delete model.attributes[`pivot_${column}`];
        }
      }
      model.pivot = pivotData;
      return model;
    });
  }

  async attach(id: any, attributes: any = {}): Promise<void> {
    const pivotData = {
      [this.parentPivotKey]: this.parent.getAttribute(this.localKey),
      [this.relatedPivotKey]: id,
      ...attributes
    };

    if (this.pivotTimestamps) {
      const now = new Date();
      pivotData.created_at = now;
      pivotData.updated_at = now;
    }

    await new QueryBuilder(this.pivotTable).insert(pivotData);
  }

  async detach(id?: any): Promise<number> {
    const query = new QueryBuilder(this.pivotTable)
      .where(this.parentPivotKey, this.parent.getAttribute(this.localKey));

    if (id !== undefined) {
      query.where(this.relatedPivotKey, id);
    }

    return query.delete();
  }

  async sync(ids: any[]): Promise<void> {
    await this.detach();
    for (const id of ids) {
      await this.attach(id);
    }
  }
}

export class HasManyThrough<T = any> extends Relation<T[]> {
  protected through: typeof Model;
  protected firstKey: string;
  protected secondKey: string;
  protected localKey: string;
  protected secondLocalKey: string;

  constructor(
    parent: Model,
    related: typeof Model,
    through: typeof Model,
    firstKey: string,
    secondKey: string,
    localKey: string = 'id',
    secondLocalKey: string = 'id'
  ) {
    super(parent, related, secondKey, localKey);
    this.through = through;
    this.firstKey = firstKey;
    this.secondKey = secondKey;
    this.localKey = localKey;
    this.secondLocalKey = secondLocalKey;
  }

  addConstraints(): void {
    // Constraints added when executing query
  }

  async getResults(): Promise<T[]> {
    return this.newQuery()
      .select(`${this.related.getTableName()}.*`)
      .join(this.through.getTableName(), `${this.related.getTableName()}.${this.secondLocalKey}`, `${this.through.getTableName()}.${this.secondKey}`)
      .where(`${this.through.getTableName()}.${this.firstKey}`, this.parent.getAttribute(this.localKey))
      .get();
  }
}

// Polymorphic Relations
export class MorphTo<T = any> extends Relation<T> {
  protected morphType: string;
  protected morphId: string;

  constructor(parent: Model, morphType: string, morphId: string) {
    super(parent, Model as any, morphId, 'id');
    this.morphType = morphType;
    this.morphId = morphId;
  }

  addConstraints(): void {
    // Constraints added when executing query
  }

  async getResults(): Promise<T | null> {
    const morphType = this.parent.getAttribute(this.morphType);
    const morphId = this.parent.getAttribute(this.morphId);

    if (!morphType || !morphId) {
      return null;
    }

    // Resolve model class from registry
    const ModelClass = ModelRegistry.get(morphType);
    if (!ModelClass) {
      throw new Error(`Model '${morphType}' not found in registry. Register it using ModelRegistry.register()`);
    }

    return new QueryBuilder((ModelClass as any).getTableName(), ModelClass)
      .where((ModelClass as any).getPrimaryKey(), morphId)
      .first();
  }
}

export class MorphMany<T = any> extends Relation<T[]> {
  protected morphType: string;
  protected morphId: string;
  protected morphClass: string;

  constructor(parent: Model, related: typeof Model, morphType: string, morphId: string, morphClass: string) {
    super(parent, related, morphId, 'id');
    this.morphType = morphType;
    this.morphId = morphId;
    this.morphClass = morphClass;
  }

  addConstraints(): void {
    // Constraints added when executing query
  }

  async getResults(): Promise<T[]> {
    return this.newQuery()
      .where(this.morphType, this.morphClass)
      .where(this.morphId, this.parent.getAttribute(this.localKey))
      .get();
  }
}

export default Relation;