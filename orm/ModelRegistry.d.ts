import Model from './Model';

export default class ModelRegistry {
  private static models: Map<string, typeof Model>;

  static register(name: string, model: typeof Model): void;
  static get(name: string): typeof Model | undefined;
  static has(name: string): boolean;
  static all(): Map<string, typeof Model>;
  static clear(): void;
}