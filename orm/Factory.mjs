import { faker } from '@faker-js/faker';

class Factory {
  constructor(model, definition) {
    this.model = model;
    this.definition = definition;
    this.states = new Map();
    this.afterCreating = [];
    this.afterMaking = [];
    this.count = 1;
    this.activeStates = [];
  }

  static define(model, definition) {
    return new Factory(model, definition);
  }

  state(name, attributes) {
    if (typeof attributes === 'function') {
      this.states.set(name, attributes);
    } else {
      this.states.set(name, () => attributes);
    }
    return this;
  }

  times(count) {
    this.count = count;
    return this;
  }

  as(stateName) {
    this.activeStates.push(stateName);
    return this;
  }

  afterCreating(callback) {
    this.afterCreating.push(callback);
    return this;
  }

  afterMaking(callback) {
    this.afterMaking.push(callback);
    return this;
  }

  async make(attributes = {}) {
    const instances = [];
    
    for (let i = 0; i < this.count; i++) {
      const baseAttributes = this.definition(faker);
      
      // Apply states
      let stateAttributes = {};
      for (const stateName of this.activeStates) {
        if (this.states.has(stateName)) {
          const stateDefinition = this.states.get(stateName);
          stateAttributes = { ...stateAttributes, ...stateDefinition(faker) };
        }
      }
      
      const finalAttributes = { ...baseAttributes, ...stateAttributes, ...attributes };
      const instance = new this.model(finalAttributes);
      
      // Run after making callbacks
      for (const callback of this.afterMaking) {
        await callback(instance);
      }
      
      instances.push(instance);
    }
    
    return this.count === 1 ? instances[0] : instances;
  }

  async create(attributes = {}) {
    const instances = await this.make(attributes);
    const instancesToSave = Array.isArray(instances) ? instances : [instances];
    const savedInstances = [];
    
    for (const instance of instancesToSave) {
      const saved = await instance.save();
      
      // Run after creating callbacks
      for (const callback of this.afterCreating) {
        await callback(saved);
      }
      
      savedInstances.push(saved);
    }
    
    return this.count === 1 ? savedInstances[0] : savedInstances;
  }

  async createMany(count, attributes = {}) {
    return this.times(count).create(attributes);
  }

  async makeMany(count, attributes = {}) {
    return this.times(count).make(attributes);
  }

  // Relationship factories
  for(model) {
    return new RelationshipFactory(this, model);
  }

  // Sequence support
  sequence(callback) {
    let counter = 0;
    const originalDefinition = this.definition;
    
    this.definition = (faker) => {
      const baseAttributes = originalDefinition(faker);
      const sequenceAttributes = callback(++counter, faker);
      return { ...baseAttributes, ...sequenceAttributes };
    };
    
    return this;
  }

  // Conditional attributes
  when(condition, attributes) {
    const originalDefinition = this.definition;
    
    this.definition = (faker) => {
      const baseAttributes = originalDefinition(faker);
      if (condition) {
        const conditionalAttributes = typeof attributes === 'function' 
          ? attributes(faker) 
          : attributes;
        return { ...baseAttributes, ...conditionalAttributes };
      }
      return baseAttributes;
    };
    
    return this;
  }

  // Raw attributes (bypass model instantiation)
  raw(attributes = {}) {
    const baseAttributes = this.definition(faker);
    
    // Apply states
    let stateAttributes = {};
    for (const stateName of this.activeStates) {
      if (this.states.has(stateName)) {
        const stateDefinition = this.states.get(stateName);
        stateAttributes = { ...stateAttributes, ...stateDefinition(faker) };
      }
    }
    
    return { ...baseAttributes, ...stateAttributes, ...attributes };
  }
}

class RelationshipFactory {
  constructor(parentFactory, model) {
    this.parentFactory = parentFactory;
    this.model = model;
  }

  create(attributes = {}) {
    // This would create related models
    // Implementation depends on relationship type
    return this.model.factory().create(attributes);
  }

  make(attributes = {}) {
    return this.model.factory().make(attributes);
  }
}

// Global factory registry
const factories = new Map();

export function defineFactory(model, definition) {
  const factory = new Factory(model, definition);
  factories.set(model.name, factory);
  
  // Add factory method to model
  model.factory = function(attributes) {
    const factoryInstance = new Factory(model, definition);
    if (attributes) {
      return factoryInstance.make(attributes);
    }
    return factoryInstance;
  };
  
  return factory;
}

export function getFactory(modelName) {
  return factories.get(modelName);
}

export { Factory, faker };
export default Factory;