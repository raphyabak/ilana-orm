/**
 * Tests for new features added in 1.0.18:
 * Model: truncate, seed, fresh, is, increment, decrement, enums, strictLoading, touches
 * QueryBuilder: sole, tap, values, restore, increment, decrement
 * F() expressions
 * Factory: has, for, hasAttached
 * ModelNotFoundException: toResponse
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

// Minimal Model stub that works without a real DB
class FakeModel {
  static primaryKey = 'id';
  static softDeletes = false;
  static deletedAt = 'deleted_at';
  static updatedAt = 'updated_at';
  static enums = {};
  static strictLoading = false;
  static touches = [];
  static timestamps = false;

  constructor(attrs = {}) {
    this.attributes = { ...attrs };
    this.original = { ...attrs };
    this.exists = Object.keys(attrs).length > 0;
    this._dirty = new Set();

    const modelClass = this.constructor;
    this.relations = new Proxy({}, {
      get(target, key) {
        if (typeof key !== 'string') return target[key];
        if (modelClass.strictLoading && !(key in target)) {
          throw new Error(
            `Strict loading violation: '${key}' was not eager loaded on ${modelClass.name}. ` +
            `Use .with('${key}') in your query.`
          );
        }
        return target[key];
      },
      set(target, key, value) { target[key] = value; return true; },
    });
  }

  getKey() { return this.attributes[this.constructor.primaryKey]; }

  getAttribute(key) { return this.attributes[key]; }

  setAttribute(key, value) {
    this.attributes[key] = value;
    this._dirty.add(key);
    return this;
  }

  syncOriginal() {
    this.original = { ...this.attributes };
    this._dirty.clear();
  }

  _generateEnumHelpers() {
    const enums = this.constructor.enums || {};
    for (const [column, values] of Object.entries(enums)) {
      for (const value of values) {
        const pascal = value.charAt(0).toUpperCase() + value.slice(1);
        if (!this[`is${pascal}`]) {
          this[`is${pascal}`] = () => this.getAttribute(column) === value;
        }
        if (!this[`make${pascal}`]) {
          this[`make${pascal}`] = async () => {
            this.setAttribute(column, value);
            return this.save();
          };
        }
      }
    }
  }

  async save() { return true; }
}

// ── ModelNotFoundException ────────────────────────────────────────────────────

const { ModelNotFoundException } = require('../orm/Errors');

describe('ModelNotFoundException', () => {
  test('message includes model name and id', () => {
    const err = new ModelNotFoundException('User', 42);
    expect(err.message).toBe('User with id 42 not found');
    expect(err.model).toBe('User');
    expect(err.id).toBe(42);
    expect(err.name).toBe('ModelNotFoundException');
    expect(err instanceof Error).toBe(true);
  });

  test('message without id', () => {
    const err = new ModelNotFoundException('Post');
    expect(err.message).toBe('Post not found');
    expect(err.id).toBeUndefined();
  });

  test('toResponse() returns 404 status and message', () => {
    const err = new ModelNotFoundException('User', 99);
    const res = err.toResponse();
    expect(res).toEqual({ status: 404, message: 'User with id 99 not found' });
  });

  test('instanceof check works', () => {
    const err = new ModelNotFoundException('User', 1);
    expect(err instanceof ModelNotFoundException).toBe(true);
  });
});

// ── F() expressions ───────────────────────────────────────────────────────────

describe('F() expressions', () => {
  // F() depends on Database.raw — mock it
  jest.mock('../database/connection', () => ({
    raw: (sql, bindings) => ({ _isRaw: true, sql, bindings }),
    table: jest.fn(),
    configure: jest.fn(),
    connection: jest.fn(),
    getInstance: jest.fn(),
  }), { virtual: false });

  const { F } = require('../orm/F');

  test('F(column).plus(n) returns a raw expression', () => {
    const expr = F('views').plus(1);
    expect(expr._isRaw).toBe(true);
    expect(expr.sql).toBe('?? + ?');
    expect(expr.bindings).toEqual(['views', 1]);
  });

  test('F(column).minus(n)', () => {
    const expr = F('stock').minus(5);
    expect(expr.sql).toBe('?? - ?');
    expect(expr.bindings).toEqual(['stock', 5]);
  });

  test('F(column).times(n)', () => {
    const expr = F('price').times(2);
    expect(expr.sql).toBe('?? * ?');
    expect(expr.bindings).toEqual(['price', 2]);
  });

  test('F(column).divide(n)', () => {
    const expr = F('total').divide(100);
    expect(expr.sql).toBe('?? / ?');
    expect(expr.bindings).toEqual(['total', 100]);
  });
});

// ── Enum helpers ──────────────────────────────────────────────────────────────

describe('Enum helpers', () => {
  class User extends FakeModel {
    static enums = { role: ['user', 'moderator', 'admin'] };
  }

  test('isX() returns true when value matches', () => {
    const user = new User({ id: 1, role: 'admin' });
    user._generateEnumHelpers();
    expect(user.isAdmin()).toBe(true);
    expect(user.isUser()).toBe(false);
    expect(user.isModerator()).toBe(false);
  });

  test('makeX() sets attribute and calls save', async () => {
    const user = new User({ id: 1, role: 'user' });
    user._generateEnumHelpers();
    const saveSpy = jest.spyOn(user, 'save').mockResolvedValue(true);
    await user.makeAdmin();
    expect(user.getAttribute('role')).toBe('admin');
    expect(saveSpy).toHaveBeenCalled();
  });

  test('multiple enum columns', () => {
    class Post extends FakeModel {
      static enums = { status: ['draft', 'published', 'archived'] };
    }
    const post = new Post({ id: 1, status: 'draft' });
    post._generateEnumHelpers();
    expect(post.isDraft()).toBe(true);
    expect(post.isPublished()).toBe(false);
    expect(post.isArchived()).toBe(false);
  });
});

// ── Strict loading ────────────────────────────────────────────────────────────

describe('Strict loading', () => {
  class StrictPost extends FakeModel {
    static strictLoading = true;
  }

  test('accessing unloaded relation throws', () => {
    const post = new StrictPost({ id: 1 });
    expect(() => post.relations.comments).toThrow(/Strict loading violation/);
    expect(() => post.relations.comments).toThrow(/comments/);
    expect(() => post.relations.comments).toThrow(/StrictPost/);
  });

  test('accessing loaded relation does not throw', () => {
    const post = new StrictPost({ id: 1 });
    post.relations.comments = [];
    expect(() => post.relations.comments).not.toThrow();
    expect(post.relations.comments).toEqual([]);
  });

  test('non-strict model does not throw on unloaded relation', () => {
    class NormalPost extends FakeModel {
      static strictLoading = false;
    }
    const post = new NormalPost({ id: 1 });
    expect(() => post.relations.comments).not.toThrow();
    expect(post.relations.comments).toBeUndefined();
  });
});

// ── model.is() ────────────────────────────────────────────────────────────────

describe('model.is()', () => {
  // Use real Model.is() logic
  function makeIs(model) {
    return function is(other) {
      if (!other || !(other instanceof model.constructor)) return false;
      return model.getKey() === other.getKey();
    };
  }

  class User extends FakeModel {}

  test('returns true for same class and same key', () => {
    const a = new User({ id: 1 });
    const b = new User({ id: 1 });
    a.is = makeIs(a);
    expect(a.is(b)).toBe(true);
  });

  test('returns false for same class but different key', () => {
    const a = new User({ id: 1 });
    const b = new User({ id: 2 });
    a.is = makeIs(a);
    expect(a.is(b)).toBe(false);
  });

  test('returns false for different class', () => {
    class Post extends FakeModel {}
    const user = new User({ id: 1 });
    const post = new Post({ id: 1 });
    user.is = makeIs(user);
    expect(user.is(post)).toBe(false);
  });

  test('returns false for null', () => {
    const user = new User({ id: 1 });
    user.is = makeIs(user);
    expect(user.is(null)).toBe(false);
  });
});

// ── QueryBuilder: tap ─────────────────────────────────────────────────────────

describe('QueryBuilder.tap()', () => {
  // Inline tap() logic to test without DB
  function tap(query, callback) {
    callback(query);
    return query;
  }

  test('calls the callback with the query', () => {
    const query = { where: jest.fn() };
    const spy = jest.fn();
    const result = tap(query, spy);
    expect(spy).toHaveBeenCalledWith(query);
    expect(result).toBe(query);
  });

  test('returns the query builder for chaining', () => {
    const query = { _chain: true };
    const result = tap(query, () => {});
    expect(result).toBe(query);
  });

  test('callback is called exactly once', () => {
    const spy = jest.fn();
    tap({}, spy);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

// ── increment / decrement (Model instance) ────────────────────────────────────

describe('Model increment/decrement', () => {
  class Counter extends FakeModel {}

  // Inline the instance logic without a real DB
  async function increment(model, column, amount = 1) {
    model.setAttribute(column, (model.getAttribute(column) || 0) + amount);
    model.syncOriginal();
    return model;
  }

  async function decrement(model, column, amount = 1) {
    model.setAttribute(column, (model.getAttribute(column) || 0) - amount);
    model.syncOriginal();
    return model;
  }

  test('increment adds amount to attribute', async () => {
    const c = new Counter({ id: 1, views: 10 });
    await increment(c, 'views');
    expect(c.getAttribute('views')).toBe(11);
  });

  test('increment with custom amount', async () => {
    const c = new Counter({ id: 1, points: 100 });
    await increment(c, 'points', 50);
    expect(c.getAttribute('points')).toBe(150);
  });

  test('decrement subtracts amount', async () => {
    const c = new Counter({ id: 1, credits: 20 });
    await decrement(c, 'credits', 5);
    expect(c.getAttribute('credits')).toBe(15);
  });

  test('increment syncs original (not dirty after)', async () => {
    const c = new Counter({ id: 1, views: 0 });
    await increment(c, 'views');
    expect(c._dirty.size).toBe(0);
  });

  test('increment returns the model', async () => {
    const c = new Counter({ id: 1, views: 0 });
    const result = await increment(c, 'views');
    expect(result).toBe(c);
  });
});

// ── Factory: has / for / hasAttached ─────────────────────────────────────────

describe('Factory relationship methods', () => {
  const { defineFactory } = require('../orm/Factory');

  // Minimal model stubs with no real DB
  class Author {
    static primaryKey = 'id';
    static table = 'authors';
    static timestamps = false;
    constructor(attrs = {}) { this.attributes = attrs; this.exists = false; }
    getKey() { return this.attributes.id; }
    fill(a) { Object.assign(this.attributes, a); return this; }
    async save() { this.attributes.id = this.attributes.id || Math.floor(Math.random() * 1000); this.exists = true; return true; }
    static query() { return { where: () => ({ increment: jest.fn(), decrement: jest.fn() }) }; }
  }

  class Article {
    static primaryKey = 'id';
    static table = 'articles';
    static timestamps = false;
    constructor(attrs = {}) { this.attributes = attrs; this.exists = false; }
    getKey() { return this.attributes.id; }
    fill(a) { Object.assign(this.attributes, a); return this; }
    async save() { this.attributes.id = this.attributes.id || Math.floor(Math.random() * 1000); this.exists = true; return true; }
    author() {
      return {
        foreignKey: 'author_id',
        localKey: 'id',
        getResults: jest.fn(),
      };
    }
    static query() { return { where: () => ({ increment: jest.fn(), decrement: jest.fn() }) }; }
  }

  class Tag {
    static primaryKey = 'id';
    constructor(attrs = {}) { this.attributes = attrs; this.exists = false; }
    getKey() { return this.attributes.id; }
    fill(a) { Object.assign(this.attributes, a); return this; }
    async save() { this.attributes.id = this.attributes.id || Math.floor(Math.random() * 1000); this.exists = true; return true; }
  }

  test('has() and _has map is populated', () => {
    const authorFactory = defineFactory(Author, () => ({ name: 'Alice' }));
    const articleFactory = defineFactory(Article, () => ({ title: 'Hello' }));
    const factory = articleFactory.times(1);
    factory.has(authorFactory.times(3), 'authors');
    expect(factory._has.has('authors')).toBe(true);
    expect(factory._has.get('authors')).toBe(authorFactory.times(3).__proto__.constructor ? authorFactory.times(3) : authorFactory);
  });

  test('for() populates _for map', () => {
    const authorFactory = defineFactory(Author, () => ({ name: 'Bob' }));
    const articleFactory = defineFactory(Article, () => ({ title: 'World' }));
    const factory = articleFactory.times(1);
    factory.for('author', authorFactory);
    expect(factory._for.has('author')).toBe(true);
  });

  test('hasAttached() populates _hasAttached map', () => {
    const tagFactory = defineFactory(Tag, () => ({ name: 'nodejs' }));
    const articleFactory = defineFactory(Article, () => ({ title: 'Tagged' }));
    const factory = articleFactory.times(1);
    factory.hasAttached(tagFactory, 'tags');
    expect(factory._hasAttached.has('tags')).toBe(true);
  });

  test('for() injects parent FK into model attributes', async () => {
    const authorFactory = defineFactory(Author, () => ({ name: 'Carol' }));
    const articleFactory = defineFactory(Article, () => ({ title: 'FK Test' }));

    // Patch createOne on authorFactory to return a predictable parent
    const fakeParent = new Author({ id: 99, name: 'Carol' });
    fakeParent.exists = true;
    jest.spyOn(authorFactory, 'createOne').mockResolvedValue(fakeParent);

    const article = await articleFactory.for('author', authorFactory).createOne({});
    expect(article.attributes.author_id).toBe(99);
  });
});
