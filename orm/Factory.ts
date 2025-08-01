import { faker } from '@faker-js/faker';
import Model from './Model';

export type FactoryDefinition<T extends Model> = (faker: typeof import('@faker-js/faker').faker) => Partial<T>;

export interface FactoryEvaluator {
  hasState(state: string): boolean;
  getStates(): string[];
}

export interface FactoryBuilder<T extends Model> {
  definition: FactoryDefinition<T>;
  states: Map<string, FactoryDefinition<T>>;
  afterCreating: Array<(model: T, evaluator: FactoryEvaluator) => Promise<void> | void>;
  afterMaking: Array<(model: T, evaluator: FactoryEvaluator) => Promise<void> | void>;
}

export class Factory<T extends Model> {
  private model: new () => T;
  private definition: FactoryDefinition<T>;
  private states: Map<string, FactoryDefinition<T>> = new Map();
  private afterCreating: Array<(model: T) => Promise<void> | void> = [];
  private afterMaking: Array<(model: T) => Promise<void> | void> = [];
  private beforeCreating: Array<(model: T) => Promise<void> | void> = [];
  private beforeMaking: Array<(attributes: any) => any> = [];
  private count: number = 1;
  private currentStates: string[] = [];
  private relationships: Map<string, Factory<any>> = new Map();
  private sequence: number = 0;
  private sequences: Map<string, number> = new Map();

  constructor(model: new () => T, definition: FactoryDefinition<T>) {
    this.model = model;
    this.definition = definition;
  }

  state(name: string, definition?: FactoryDefinition<T>): this {
    if (definition) {
      this.states.set(name, definition);
    } else {
      this.currentStates.push(name);
    }
    return this;
  }

  afterCreating(callback: (model: T) => Promise<void> | void): this {
    this.afterCreating.push(callback);
    return this;
  }

  afterMaking(callback: (model: T) => Promise<void> | void): this {
    this.afterMaking.push(callback);
    return this;
  }

  beforeCreating(callback: (model: T) => Promise<void> | void): this {
    this.beforeCreating.push(callback);
    return this;
  }

  beforeMaking(callback: (attributes: any) => any): this {
    this.beforeMaking.push(callback);
    return this;
  }

  times(count: number): this {
    this.count = count;
    return this;
  }

  as(state: string): this {
    this.currentStates.push(state);
    return this;
  }

  for(relation: string, factory: Factory<any>): this {
    this.relationships.set(relation, factory);
    return this;
  }

  has(factory: Factory<any>, relation?: string): this {
    if (relation) {
      this.relationships.set(relation, factory);
    }
    return this;
  }

  hasAttached(factory: Factory<any>, relation: string): this {
    this.relationships.set(relation, factory);
    return this;
  }

  sequence(): number {
    return ++this.sequence;
  }

  // Enhanced sequence methods
  sequenceFor(key: string): number {
    if (!this.sequences) this.sequences = new Map();
    const current = this.sequences.get(key) || 0;
    const next = current + 1;
    this.sequences.set(key, next);
    return next;
  }

  resetSequence(key?: string): this {
    if (key) {
      this.sequences?.set(key, 0);
    } else {
      this.sequences?.clear();
      this.sequence = 0;
    }
    return this;
  }

  raw(attributes: Partial<T> = {}): any | any[] {
    if (this.count === 1) {
      return this.makeRaw(attributes);
    }

    const results: any[] = [];
    for (let i = 0; i < this.count; i++) {
      results.push(this.makeRaw(attributes));
    }
    return results;
  }

  async make(attributes: Partial<T> = {}): Promise<T | T[]> {
    if (this.count === 1) {
      return this.makeOne(attributes);
    }

    const models: T[] = [];
    for (let i = 0; i < this.count; i++) {
      models.push(await this.makeOne(attributes));
    }
    return models;
  }

  async create(attributes: Partial<T> = {}): Promise<T | T[]> {
    if (this.count === 1) {
      return this.createOne(attributes);
    }

    const models: T[] = [];
    for (let i = 0; i < this.count; i++) {
      models.push(await this.createOne(attributes));
    }
    return models;
  }

  private makeRaw(attributes: Partial<T> = {}): any {
    let modelAttributes = this.definition(faker);

    // Apply states
    for (const stateName of this.currentStates) {
      const stateDefinition = this.states.get(stateName);
      if (stateDefinition) {
        modelAttributes = { ...modelAttributes, ...stateDefinition(faker) };
      }
    }

    // Apply custom attributes
    modelAttributes = { ...modelAttributes, ...attributes };

    // Run beforeMaking callbacks
    for (const callback of this.beforeMaking) {
      modelAttributes = callback(modelAttributes) || modelAttributes;
    }

    return modelAttributes;
  }

  private async makeOne(attributes: Partial<T> = {}): Promise<T> {
    const modelAttributes = this.makeRaw(attributes);

    const model = new this.model();
    model.fill(modelAttributes as any);

    // Run afterMaking callbacks
    for (const callback of this.afterMaking) {
      await callback(model);
    }

    return model;
  }

  private async createOne(attributes: Partial<T> = {}): Promise<T> {
    const model = await this.makeOne(attributes);
    
    // Run beforeCreating callbacks
    for (const callback of this.beforeCreating) {
      await callback(model);
    }
    
    await model.save();

    // Run afterCreating callbacks
    for (const callback of this.afterCreating) {
      await callback(model);
    }

    return model;
  }

  // Enhanced factory methods
  configure(callback: (factory: this) => void): this {
    callback(this);
    return this;
  }

  when(condition: boolean, callback: (factory: this) => void): this {
    if (condition) {
      callback(this);
    }
    return this;
  }

  unless(condition: boolean, callback: (factory: this) => void): this {
    if (!condition) {
      callback(this);
    }
    return this;
  }

  // Advanced relationship creation
  async createWithRelations(attributes: Partial<T> = {}, relations: Record<string, any> = {}): Promise<T> {
    const model = await this.createOne(attributes);
    
    for (const [relationName, relationData] of Object.entries(relations)) {
      const relationMethod = (model as any)[relationName];
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
  async createInBatches(batchSize: number = 100, attributes: Partial<T> = {}): Promise<T[]> {
    const results: T[] = [];
    const totalBatches = Math.ceil(this.count / batchSize);
    
    for (let i = 0; i < totalBatches; i++) {
      const currentBatchSize = Math.min(batchSize, this.count - (i * batchSize));
      const batchFactory = new Factory(this.model, this.definition);
      batchFactory.count = currentBatchSize;
      batchFactory.currentStates = [...this.currentStates];
      
      const batch = await batchFactory.create(attributes) as T[];
      results.push(...(Array.isArray(batch) ? batch : [batch]));
    }
    
    return results;
  }

  // Reset factory state
  private reset(): void {
    this.count = 1;
    this.currentStates = [];
  }
}

// Factory registry
const factories = new Map<new () => Model, Factory<any>>();

export function defineFactory<T extends Model>(
  model: new () => T,
  definition: FactoryDefinition<T>
): Factory<T> {
  const factory = new Factory(model, definition);
  factories.set(model, factory);
  return factory;
}

export function factory<T extends Model>(model: new () => T): Factory<T> {
  const factory = factories.get(model);
  if (!factory) {
    throw new Error(`No factory defined for model: ${model.name}`);
  }
  return factory;
}

// Enhanced factory utilities
export function factoryForModel<T extends Model>(model: new () => T): Factory<T> {
  return factory(model);
}

export function createFactory<T extends Model>(
  model: new () => T,
  definition: FactoryDefinition<T>
): Factory<T> {
  return defineFactory(model, definition);
}

// Global factory state management
const globalSequences = new Map<string, number>();

export function globalSequence(key: string): number {
  const current = globalSequences.get(key) || 0;
  const next = current + 1;
  globalSequences.set(key, next);
  return next;
}

export function resetGlobalSequence(key?: string): void {
  if (key) {
    globalSequences.set(key, 0);
  } else {
    globalSequences.clear();
  }
}

// Factory trait system
export interface FactoryTrait<T extends Model> {
  apply(factory: Factory<T>): Factory<T>;
}

export function trait<T extends Model>(callback: (factory: Factory<T>) => Factory<T>): FactoryTrait<T> {
  return { apply: callback };
}

// Performance optimized factory
export class BulkFactory<T extends Model> {
  private model: new () => T;
  private definition: FactoryDefinition<T>;
  private batchSize: number = 1000;

  constructor(model: new () => T, definition: FactoryDefinition<T>) {
    this.model = model;
    this.definition = definition;
  }

  setBatchSize(size: number): this {
    this.batchSize = size;
    return this;
  }

  async create(count: number): Promise<T[]> {
    const results: T[] = [];
    const batches = Math.ceil(count / this.batchSize);
    
    for (let i = 0; i < batches; i++) {
      const currentBatchSize = Math.min(this.batchSize, count - (i * this.batchSize));
      const batchData = [];
      
      for (let j = 0; j < currentBatchSize; j++) {
        batchData.push(this.definition(faker));
      }
      
      const insertedIds = await (this.model as any).query().insert(batchData);
      
      for (let k = 0; k < batchData.length; k++) {
        const model = new this.model();
        model.fill({ ...batchData[k], id: insertedIds[k] });
        (model as any).exists = true;
        results.push(model);
      }
    }
    
    return results;
  }
}

export function bulkFactory<T extends Model>(
  model: new () => T,
  definition: FactoryDefinition<T>
): BulkFactory<T> {
  return new BulkFactory(model, definition);
}

// Add factory method to Model
declare module './Model' {
  namespace Model {
    function factory<T extends Model>(this: new () => T): Factory<T>;
  }
}

Model.factory = function <T extends Model>(this: new () => T): Factory<T> {
  return factory(this);
};

export default Factory;