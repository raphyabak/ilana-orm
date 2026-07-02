const { faker } = require('@faker-js/faker');
const Model = require('./Model');

class Factory {
  constructor(model, definition) {
    this.model = model;
    this.definition = definition;
    this.faker = faker;
    this.states = new Map();
    this._afterCreatingCallbacks = [];
    this._afterMakingCallbacks = [];
    this._beforeCreatingCallbacks = [];
    this._beforeMakingCallbacks = [];
    this.count = 1;
    this.currentStates = [];
    this.relationships = new Map();
    this._has = new Map();
    this._for = new Map();
    this._hasAttached = new Map();
    this._sequenceCount = 0;
    this.sequences = new Map();
  }

  state(name, definition) {
    if (definition) {
      this.states.set(name, definition);
    } else {
      this.currentStates.push(name);
    }
    return this;
  }

  afterCreating(callback) {
    this._afterCreatingCallbacks.push(callback);
    return this;
  }

  afterMaking(callback) {
    this._afterMakingCallbacks.push(callback);
    return this;
  }

  beforeCreating(callback) {
    this._beforeCreatingCallbacks.push(callback);
    return this;
  }

  beforeMaking(callback) {
    this._beforeMakingCallbacks.push(callback);
    return this;
  }

  times(count) {
    this.count = count;
    return this;
  }

  as(state) {
    this.currentStates.push(state);
    return this;
  }

  for(relation, relFactory) {
    this._for.set(relation, relFactory);
    return this;
  }

  has(relFactory, relation) {
    this._has.set(relation, relFactory);
    return this;
  }

  hasAttached(relFactory, relation) {
    this._hasAttached.set(relation, relFactory);
    return this;
  }

  _getRelation(relationName) {
    try {
      const dummy = new this.model({});
      return typeof dummy[relationName] === 'function' ? dummy[relationName]() : null;
    } catch (_) {
      return null;
    }
  }

  sequence() {
    return ++this._sequenceCount;
  }

  // Enhanced sequence methods
  sequenceFor(key) {
    if (!this.sequences) this.sequences = new Map();
    const current = this.sequences.get(key) || 0;
    const next = current + 1;
    this.sequences.set(key, next);
    return next;
  }

  resetSequence(key) {
    if (key) {
      this.sequences?.set(key, 0);
    } else {
      this.sequences?.clear();
      this._sequenceCount = 0;
    }
    return this;
  }

  raw(attributes = {}) {
    if (this.count === 1) {
      return this.makeRaw(attributes);
    }

    const results = [];
    for (let i = 0; i < this.count; i++) {
      results.push(this.makeRaw(attributes));
    }
    return results;
  }

  async make(attributes = {}) {
    if (this.count === 1) {
      return this.makeOne(attributes);
    }

    const models = [];
    for (let i = 0; i < this.count; i++) {
      models.push(await this.makeOne(attributes));
    }
    return models;
  }

  async create(attributes = {}) {
    if (this.count === 1) {
      return this.createOne(attributes);
    }

    const models = [];
    for (let i = 0; i < this.count; i++) {
      models.push(await this.createOne(attributes));
    }
    return models;
  }

  makeRaw(attributes = {}) {
    let modelAttributes;
    
    if (typeof this.definition === 'function') {
      modelAttributes = this.definition(faker);
    } else {
      throw new Error('Factory must have a definition function');
    }

    for (const stateName of this.currentStates) {
      const stateDefinition = this.states.get(stateName);
      if (stateDefinition) {
        modelAttributes = { ...modelAttributes, ...stateDefinition(faker) };
      }
    }

    modelAttributes = { ...modelAttributes, ...attributes };

    for (const callback of this._beforeMakingCallbacks) {
      modelAttributes = callback(modelAttributes) || modelAttributes;
    }

    return modelAttributes;
  }

  async makeOne(attributes = {}) {
    const modelAttributes = this.makeRaw(attributes);

    const model = new this.model();
    model.fill(modelAttributes);

    // Run afterMaking callbacks
    for (const callback of this._afterMakingCallbacks) {
      await callback(model);
    }

    return model;
  }

  async createOne(attributes = {}) {
    // Handle 'for' (belongsTo) — create parent first, inject FK into this model
    const parentAttrs = {};
    for (const [relationName, relFactory] of this._for) {
      const parent = await relFactory.createOne({});
      const rel = this._getRelation(relationName);
      if (rel && rel.foreignKey) parentAttrs[rel.foreignKey] = parent.getKey();
    }

    const model = await this.makeOne({ ...parentAttrs, ...attributes });

    for (const callback of this._beforeCreatingCallbacks) {
      await callback(model);
    }

    await model.save();

    // Handle 'has' (hasMany) — create children with FK pointing to this model
    for (const [relationName, relFactory] of this._has) {
      const rel = this._getRelation(relationName);
      if (rel && rel.foreignKey) {
        await relFactory.create({ [rel.foreignKey]: model.getKey() });
      }
    }

    // Handle 'hasAttached' (belongsToMany) — create and attach via pivot
    for (const [relationName, relFactory] of this._hasAttached) {
      const related = await relFactory.create({});
      const relatedArr = Array.isArray(related) ? related : [related];
      const rel = this._getRelation(relationName);
      if (rel && typeof rel.attach === 'function') {
        for (const r of relatedArr) await rel.attach(r.getKey());
      }
    }

    for (const callback of this._afterCreatingCallbacks) {
      await callback(model);
    }

    return model;
  }

  // Enhanced factory methods
  configure(callback) {
    callback(this);
    return this;
  }

  when(condition, callback) {
    if (condition) {
      callback(this);
    }
    return this;
  }

  unless(condition, callback) {
    if (!condition) {
      callback(this);
    }
    return this;
  }

  // Advanced relationship creation
  async createWithRelations(attributes = {}, relations = {}) {
    const model = await this.createOne(attributes);
    
    for (const [relationName, relationData] of Object.entries(relations)) {
      const relationMethod = model[relationName];
      if (typeof relationMethod === 'function') {
        const relation = relationMethod.call(model);
        if (relation.constructor.name === 'BelongsToMany') {
          if (Array.isArray(relationData)) {
            for (const data of relationData) {
              await relation.attach(data.id || data, data);
            }
          }
        }
      }
    }
    
    return model;
  }

  // Batch operations
  async createInBatches(batchSize = 100, attributes = {}) {
    const results = [];
    const totalBatches = Math.ceil(this.count / batchSize);
    
    for (let i = 0; i < totalBatches; i++) {
      const currentBatchSize = Math.min(batchSize, this.count - (i * batchSize));
      const batchFactory = new Factory(this.model, this.definition);
      batchFactory.count = currentBatchSize;
      batchFactory.currentStates = [...this.currentStates];
      batchFactory._afterCreatingCallbacks = [...this._afterCreatingCallbacks];
      batchFactory._beforeCreatingCallbacks = [...this._beforeCreatingCallbacks];
      
      const batch = await batchFactory.create(attributes);
      results.push(...(Array.isArray(batch) ? batch : [batch]));
    }
    
    return results;
  }
}

// Factory registry
const factories = new Map();

function defineFactory(model, definition) {
  const factory = new Factory(model, definition);
  factories.set(model, factory);
  return factory;
}

function factory(model) {
  const factory = factories.get(model);
  if (!factory) {
    throw new Error(`No factory defined for model: ${model.name}`);
  }
  return factory;
}

// Enhanced factory utilities
function factoryForModel(model) {
  return factory(model);
}

function createFactory(model, definition) {
  return defineFactory(model, definition);
}

// Global factory state management
const globalSequences = new Map();

function globalSequence(key) {
  const current = globalSequences.get(key) || 0;
  const next = current + 1;
  globalSequences.set(key, next);
  return next;
}

function resetGlobalSequence(key) {
  if (key) {
    globalSequences.set(key, 0);
  } else {
    globalSequences.clear();
  }
}

// Factory trait system
function trait(callback) {
  return { apply: callback };
}

// Performance optimized factory
class BulkFactory {
  constructor(model, definition) {
    this.model = model;
    this.definition = definition;
    this.batchSize = 1000;
  }

  setBatchSize(size) {
    this.batchSize = size;
    return this;
  }

  async create(count) {
    const results = [];
    const batches = Math.ceil(count / this.batchSize);
    
    for (let i = 0; i < batches; i++) {
      const currentBatchSize = Math.min(this.batchSize, count - (i * this.batchSize));
      const batchData = [];
      
      for (let j = 0; j < currentBatchSize; j++) {
        batchData.push(this.definition(faker));
      }
      
      const insertedIds = await this.model.query().insert(batchData);
      
      for (let k = 0; k < batchData.length; k++) {
        const model = new this.model();
        model.fill({ ...batchData[k], id: insertedIds[k] });
        model.exists = true;
        results.push(model);
      }
    }
    
    return results;
  }
}

function bulkFactory(model, definition) {
  return new BulkFactory(model, definition);
}

// Add factory method to Model prototype
if (typeof Model !== 'undefined') {
  Model.factory = function() {
    const existingFactory = factories.get(this);
    if (existingFactory) {
      // Return a new instance to avoid state pollution
      const newFactory = new Factory(this, existingFactory.definition);
      newFactory.states = new Map(existingFactory.states);
      newFactory._afterCreatingCallbacks = [...existingFactory._afterCreatingCallbacks];
      newFactory._beforeCreatingCallbacks = [...existingFactory._beforeCreatingCallbacks];
      newFactory._has = new Map(existingFactory._has);
      newFactory._for = new Map(existingFactory._for);
      newFactory._hasAttached = new Map(existingFactory._hasAttached);
      return newFactory;
    }
    throw new Error(`No factory defined for model: ${this.name}`);
  };
}

module.exports = {
  Factory,
  defineFactory,
  factory,
  factoryForModel,
  createFactory,
  globalSequence,
  resetGlobalSequence,
  trait,
  BulkFactory,
  bulkFactory
};