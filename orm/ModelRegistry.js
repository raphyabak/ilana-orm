class ModelRegistry {
  static models = new Map();

  static register(name, model) {
    if (!name || !model) return;
    this.models.set(name, model);
  }

  static get(name) {
    return this.models.get(name);
  }

  static has(name) {
    return this.models.has(name);
  }

  static all() {
    return new Map(this.models);
  }

  static clear() {
    this.models.clear();
  }
}

module.exports = ModelRegistry;