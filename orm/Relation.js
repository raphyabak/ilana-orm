const QueryBuilder = require('./QueryBuilder');
const Model = require('./Model');
const ModelRegistry = require('./ModelRegistry');

class Relation {
  constructor(parent, related, foreignKey, localKey = 'id') {
    this.parent = parent;
    this.related = related;
    this.foreignKey = foreignKey;
    this.localKey = localKey;
  }

  getRelatedClass() {
    // If it's a string, resolve from registry
    if (typeof this.related === 'string') {
      return this.parent.constructor.resolveRelatedModel(this.related);
    }
    
    // If it's a function (class), check if it's properly initialized
    if (typeof this.related === 'function') {
      // For classes that might not be fully loaded, try to get from registry first
      if (this.related.name && ModelRegistry.has(this.related.name)) {
        return ModelRegistry.get(this.related.name);
      }
      
      // If not in registry but has required methods, use it directly
      if (this.related.getTableName && typeof this.related.getTableName === 'function') {
        return this.related;
      }
      
      // If it's a lazy loading function
      if (this.related.length === 0) {
        const resolved = this.related();
        return resolved;
      }
    }
    
    return this.related;
  }

  newQuery() {
    const relatedClass = this.getRelatedClass();
    return new QueryBuilder(relatedClass.getTableName(), relatedClass, relatedClass.getConnectionName());
  }
}

class HasOne extends Relation {
  addConstraints() {
    // Constraints added when executing query
  }

  getRelatedClass() {
    return super.getRelatedClass();
  }

  async getResults() {
    return this.newQuery()
      .where(this.foreignKey, this.parent.getAttribute(this.localKey))
      .first();
  }
}

class HasMany extends Relation {
  addConstraints() {
    // Constraints added when executing query
  }

  getRelatedClass() {
    return super.getRelatedClass();
  }

  async getResults() {
    return this.newQuery()
      .where(this.foreignKey, this.parent.getAttribute(this.localKey))
      .get();
  }
}

class BelongsTo extends Relation {
  addConstraints() {
    // Constraints added when executing query
  }

  getRelatedClass() {
    return super.getRelatedClass();
  }

  async getResults() {
    return this.newQuery()
      .where(this.localKey, this.parent.getAttribute(this.foreignKey))
      .first();
  }
}

class BelongsToMany extends Relation {
  constructor(
    parent,
    related,
    pivotTable,
    foreignPivotKey,
    relatedPivotKey,
    parentKey = 'id',
    relatedKey = 'id'
  ) {
    super(parent, related, relatedKey, parentKey);
    
    const relatedClass = this.getRelatedClass();
    
    this.pivotTable = pivotTable || [
      parent.constructor.getTableName(),
      relatedClass.getTableName()
    ].sort().join('_');
    
    this.parentPivotKey = foreignPivotKey || `${parent.constructor.getTableName().slice(0, -1)}_id`;
    this.relatedPivotKey = relatedPivotKey || `${relatedClass.getTableName().slice(0, -1)}_id`;
    this.parentKey = parentKey || parent.constructor.getPrimaryKey();
    this.relatedKey = relatedKey || relatedClass.getPrimaryKey();
    this.pivotColumns = [];
    this.pivotTimestamps = false;
  }

  withPivot(...columns) {
    this.pivotColumns.push(...columns);
    return this;
  }

  withTimestamps() {
    this.pivotTimestamps = true;
    this.pivotColumns.push('created_at', 'updated_at');
    return this;
  }

  addConstraints() {
    // Constraints added when executing query
  }

  async getResults() {
    const relatedClass = this.getRelatedClass();
    const selectColumns = [`${relatedClass.getTableName()}.*`];
    
    // Add pivot columns
    if (this.pivotColumns.length > 0) {
      for (const column of this.pivotColumns) {
        selectColumns.push(`${this.pivotTable}.${column} as pivot_${column}`);
      }
    }
    
    const query = this.newQuery()
      .select(...selectColumns)
      .join(this.pivotTable, `${relatedClass.getTableName()}.${this.relatedKey}`, `${this.pivotTable}.${this.relatedPivotKey}`)
      .where(`${this.pivotTable}.${this.parentPivotKey}`, this.parent.getAttribute(this.parentKey));

    const results = await query.get();
    
    // Convert Collection to array if needed
    const resultsArray = Array.isArray(results) ? results : Array.from(results);
    
    // Add pivot data to models
    return resultsArray.map((model) => {
      const pivotData = {};
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

  async attach(id, attributes = {}) {
    const pivotData = {
      [this.parentPivotKey]: this.parent.getAttribute(this.parentKey),
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

  async detach(id) {
    const query = new QueryBuilder(this.pivotTable)
      .where(this.parentPivotKey, this.parent.getAttribute(this.parentKey));

    if (id !== undefined) {
      query.where(this.relatedPivotKey, id);
    }

    return query.delete();
  }

  async sync(ids) {
    await this.detach();
    for (const id of ids) {
      await this.attach(id);
    }
  }
}

class HasManyThrough extends Relation {
  constructor(
    parent,
    related,
    through,
    firstKey,
    secondKey,
    localKey = 'id',
    secondLocalKey = 'id'
  ) {
    super(parent, related, secondKey, localKey);
    this.through = through;
    this.firstKey = firstKey;
    this.secondKey = secondKey;
    this.localKey = localKey;
    this.secondLocalKey = secondLocalKey;
  }

  addConstraints() {
    // Constraints added when executing query
  }

  async getResults() {
    return this.newQuery()
      .select(`${this.related.getTableName()}.*`)
      .join(this.through.getTableName(), `${this.related.getTableName()}.${this.secondLocalKey}`, `${this.through.getTableName()}.${this.secondKey}`)
      .where(`${this.through.getTableName()}.${this.firstKey}`, this.parent.getAttribute(this.localKey))
      .get();
  }
}

// Polymorphic Relations
class MorphTo extends Relation {
  constructor(parent, morphType, morphId) {
    super(parent, Model, morphId, 'id');
    this.morphType = morphType;
    this.morphId = morphId;
  }

  addConstraints() {
    // Constraints added when executing query
  }

  async getResults() {
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

    return new QueryBuilder(ModelClass.getTableName(), ModelClass)
      .where(ModelClass.getPrimaryKey(), morphId)
      .first();
  }
}

class MorphMany extends Relation {
  constructor(parent, related, morphType, morphId, morphClass) {
    super(parent, related, morphId, 'id');
    this.morphType = morphType;
    this.morphId = morphId;
    this.morphClass = morphClass;
  }

  addConstraints() {
    // Constraints added when executing query
  }

  async getResults() {
    return this.newQuery()
      .where(this.morphType, this.morphClass)
      .where(this.morphId, this.parent.getAttribute(this.localKey))
      .get();
  }
}

module.exports = {
  Relation,
  HasOne,
  HasMany,
  BelongsTo,
  BelongsToMany,
  HasManyThrough,
  MorphTo,
  MorphMany
};