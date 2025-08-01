import Model from './Model';

class ModelRegistry {
  private static models: Map<string, new () => Model> = new Map();

  static register(name: string, model: new () => Model): void {
    this.models.set(name, model);
  }

  static get(name: string): new () => Model | undefined {
    return this.models.get(name);
  }

  static has(name: string): boolean {
    return this.models.has(name);
  }

  static all(): Map<string, new () => Model> {
    return new Map(this.models);
  }
}

export default ModelRegistry;