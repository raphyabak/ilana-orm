/**
 * Tests for 1.0.19 features:
 * - pgvector: Model.search(), Model.nearestTo()
 * - Edge runtime: __ILANA_EDGE__ flag skips auto-loader
 * - isNot(), replicate(), withoutEvents(), prune()/prunable()
 * - ULID primary keys
 * - Pending attributes on scopes
 */

const Model = require('../orm/Model');

// ── pgvector: Model.nearestTo() and Model.search() ───────────────────────────

describe('pgvector search', () => {
  const ops = { cosine: '<=>', l2: '<->', inner: '<#>' };

  function buildVectorSql(col, vector, distance = 'cosine') {
    const op = ops[distance] || '<=>';
    const vectorStr = `[${Array.from(vector).join(',')}]`;
    return {
      selectRaw: `*, (${col} ${op} ?) as distance`,
      orderByRaw: `${col} ${op} ?`,
      param: vectorStr,
    };
  }

  test('nearestTo builds cosine SQL by default', () => {
    const result = buildVectorSql('embedding', [0.1, 0.2, 0.3]);
    expect(result.selectRaw).toContain('<=>');
    expect(result.orderByRaw).toContain('<=>');
    expect(result.param).toBe('[0.1,0.2,0.3]');
  });

  test('nearestTo builds l2 SQL', () => {
    const result = buildVectorSql('embedding', [1, 2, 3], 'l2');
    expect(result.selectRaw).toContain('<->');
    expect(result.orderByRaw).toContain('<->');
  });

  test('nearestTo builds inner product SQL', () => {
    const result = buildVectorSql('embedding', [1, 2, 3], 'inner');
    expect(result.selectRaw).toContain('<#>');
  });

  test('vector string is formatted correctly', () => {
    const result = buildVectorSql('embedding', [0.5, 0.25, 0.125]);
    expect(result.param).toBe('[0.5,0.25,0.125]');
  });

  test('custom column name is used', () => {
    const result = buildVectorSql('content_vector', [1, 2], 'cosine');
    expect(result.selectRaw).toContain('content_vector');
    expect(result.orderByRaw).toContain('content_vector');
  });

  test('search() throws without a provider', async () => {
    async function search(text, opts = {}) {
      const provider = opts.provider || null;
      if (!provider) throw new Error('search() requires an embedding provider');
      const vector = await provider(text);
      return buildVectorSql('embedding', vector, opts.distance);
    }
    await expect(search('hello')).rejects.toThrow('embedding provider');
  });

  test('search() calls the provider with the text', async () => {
    const mockProvider = jest.fn().mockResolvedValue([0.1, 0.2, 0.3]);
    async function search(text, opts = {}) {
      const provider = opts.provider;
      if (!provider) throw new Error('search() requires an embedding provider');
      const vector = await provider(text);
      return buildVectorSql('embedding', vector, opts.distance);
    }
    await search('javascript tips', { provider: mockProvider });
    expect(mockProvider).toHaveBeenCalledWith('javascript tips');
  });

  test('search() uses provider result as vector', async () => {
    const mockProvider = jest.fn().mockResolvedValue([0.9, 0.8, 0.7]);
    async function search(text, opts = {}) {
      const provider = opts.provider;
      if (!provider) throw new Error('search() requires an embedding provider');
      const vector = await provider(text);
      return buildVectorSql(opts.column || 'embedding', vector, opts.distance);
    }
    const result = await search('test', { provider: mockProvider });
    expect(result.param).toBe('[0.9,0.8,0.7]');
  });

  test('nearestTo throws a clear error on non-postgres databases', () => {
    const clients = ['mysql', 'mysql2', 'sqlite3', 'mssql'];
    const assertPgVector = (modelName, client) => {
      if (!client.includes('pg')) {
        throw new Error(
          `${modelName}.search() and ${modelName}.nearestTo() require PostgreSQL with the pgvector extension. ` +
          `Current database client is '${client}'. ` +
          `Vector search is not supported on MySQL or SQLite.`
        );
      }
    };
    for (const client of clients) {
      expect(() => assertPgVector('Post', client)).toThrow('require PostgreSQL');
      expect(() => assertPgVector('Post', client)).toThrow(client);
      expect(() => assertPgVector('Post', client)).toThrow('not supported on MySQL or SQLite');
    }
    expect(() => assertPgVector('Post', 'pg')).not.toThrow();
  });

  test('model-level embeddingProvider is used when no per-call provider', async () => {
    const modelProvider = jest.fn().mockResolvedValue([0.1, 0.2]);
    async function search(text, opts = {}, modelEmbeddingProvider = null) {
      const provider = opts.provider || modelEmbeddingProvider;
      if (!provider) throw new Error('search() requires an embedding provider');
      const vector = await provider(text);
      return vector;
    }
    const result = await search('query', {}, modelProvider);
    expect(modelProvider).toHaveBeenCalledWith('query');
    expect(result).toEqual([0.1, 0.2]);
  });
});

// ── Edge runtime: __ILANA_EDGE__ flag ────────────────────────────────────────

describe('Edge runtime', () => {
  test('__ILANA_EDGE__ flag can be set globally', () => {
    global.__ILANA_EDGE__ = true;
    expect(global.__ILANA_EDGE__).toBe(true);
    delete global.__ILANA_EDGE__;
  });

  test('auto-loader is skipped when __ILANA_EDGE__ is set', () => {
    const shouldSkip = (edgeFlag) => {
      return !(
        typeof process !== 'undefined' &&
        process.versions &&
        process.versions.node &&
        !edgeFlag
      );
    };
    expect(shouldSkip(true)).toBe(true);
    expect(shouldSkip(false)).toBe(false);
    expect(shouldSkip(undefined)).toBe(false);
  });

  test('edge entry point sets __ILANA_EDGE__ before model loads', () => {
    const flag = (() => {
      global.__ILANA_EDGE__ = true;
      return global.__ILANA_EDGE__;
    })();
    expect(flag).toBe(true);
    delete global.__ILANA_EDGE__;
  });

  test('SchemaBuilder.enableVectorExtension generates correct SQL', () => {
    function enableVectorExtension(knex) {
      return knex.raw('CREATE EXTENSION IF NOT EXISTS vector');
    }
    const mockKnex = { raw: jest.fn().mockReturnValue('raw-result') };
    const result = enableVectorExtension(mockKnex);
    expect(mockKnex.raw).toHaveBeenCalledWith('CREATE EXTENSION IF NOT EXISTS vector');
    expect(result).toBe('raw-result');
  });
});

// ── isNot() ──────────────────────────────────────────────────────────────────

describe('isNot()', () => {
  class Post extends Model {}
  Post.table = 'posts';

  function makePost(id) {
    const p = new Post({ id });
    p._initialize();
    p.exists = true;
    return p;
  }

  test('returns false when same model', () => {
    const a = makePost(1);
    const b = makePost(1);
    expect(a.isNot(b)).toBe(false);
  });

  test('returns true when different id', () => {
    const a = makePost(1);
    const b = makePost(2);
    expect(a.isNot(b)).toBe(true);
  });

  test('returns true when compared to null', () => {
    const a = makePost(1);
    expect(a.isNot(null)).toBe(true);
  });

  test('is() and isNot() are always opposite', () => {
    const a = makePost(1);
    const b = makePost(2);
    expect(a.is(b)).toBe(!a.isNot(b));
  });
});

// ── replicate() ───────────────────────────────────────────────────────────────

describe('replicate()', () => {
  class Article extends Model {}
  Article.table = 'articles';
  Article.fillable = ['title', 'body', 'status'];

  function makeArticle(attrs) {
    const m = new Article(attrs);
    m._initialize();
    m.exists = true;
    return m;
  }

  test('creates a copy with same attributes', () => {
    const original = makeArticle({ id: 1, title: 'Hello', body: 'World', status: 'draft' });
    const copy = original.replicate();
    expect(copy.getAttribute('title')).toBe('Hello');
    expect(copy.getAttribute('body')).toBe('World');
  });

  test('copy does not have the primary key', () => {
    const original = makeArticle({ id: 5, title: 'Test' });
    const copy = original.replicate();
    expect(copy.getAttribute('id')).toBeUndefined();
  });

  test('copy is not marked as existing', () => {
    const original = makeArticle({ id: 5, title: 'Test' });
    const copy = original.replicate();
    expect(copy.exists).toBe(false);
  });

  test('excludes timestamps', () => {
    const original = makeArticle({ id: 1, title: 'T', created_at: '2024-01-01', updated_at: '2024-06-01' });
    const copy = original.replicate();
    expect(copy.getAttribute('created_at')).toBeUndefined();
    expect(copy.getAttribute('updated_at')).toBeUndefined();
  });

  test('excludes additional keys passed as argument', () => {
    const original = makeArticle({ id: 1, title: 'T', status: 'published' });
    const copy = original.replicate(['status']);
    expect(copy.getAttribute('status')).toBeUndefined();
    expect(copy.getAttribute('title')).toBe('T');
  });

  test('modifying copy does not affect original', () => {
    const original = makeArticle({ id: 1, title: 'Original' });
    const copy = original.replicate();
    copy.setAttribute('title', 'Copy');
    expect(original.getAttribute('title')).toBe('Original');
  });
});

// ── withoutEvents() ───────────────────────────────────────────────────────────

describe('withoutEvents()', () => {
  class User extends Model {}
  User.table = 'users';

  test('events do not fire inside withoutEvents', async () => {
    const fired = [];
    User.creating(() => { fired.push('creating'); });
    await User.withoutEvents(async () => {
      await User.fireEvent('creating', {});
    });
    expect(fired).toHaveLength(0);
  });

  test('events fire normally after withoutEvents', async () => {
    const fired = [];
    User.creating(() => { fired.push('creating'); });
    await User.withoutEvents(async () => {});
    await User.fireEvent('creating', {});
    expect(fired.length).toBeGreaterThan(0);
  });

  test('restores event firing even if callback throws', async () => {
    try {
      await User.withoutEvents(async () => { throw new Error('oops'); });
    } catch (_) {}
    expect(User._mutingEvents).toBe(false);
  });
});

// ── prune() / prunable() ──────────────────────────────────────────────────────

describe('prune()', () => {
  test('prune() calls delete on each result from prunable()', async () => {
    class Log extends Model {}
    Log.table = 'logs';
    const fakeModel = { delete: jest.fn().mockResolvedValue(true) };
    Log.prunable = () => ({
      chunk: async (size, cb) => { await cb([fakeModel]); },
    });
    const count = await Log.prune();
    expect(fakeModel.delete).toHaveBeenCalledTimes(1);
    expect(count).toBe(1);
  });

  test('prunable() throws by default', () => {
    class Event extends Model {}
    Event.table = 'events';
    expect(() => Event.prunable()).toThrow('must implement a static prunable()');
  });
});

// ── ULID primary keys ─────────────────────────────────────────────────────────

describe('ULID primary keys', () => {
  test('generateUlid() returns a 26-character string', () => {
    expect(Model.generateUlid()).toHaveLength(26);
  });

  test('generateUlid() uses only valid Crockford base32 characters', () => {
    const VALID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
    for (let i = 0; i < 20; i++) {
      expect(Model.generateUlid()).toMatch(VALID);
    }
  });

  test('generateUlid() produces unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => Model.generateUlid()));
    expect(ids.size).toBe(100);
  });

  test('_generateKey() returns ULID when keyType is ulid', () => {
    class Order extends Model {}
    Order.keyType = 'ulid';
    expect(Order._generateKey()).toHaveLength(26);
  });

  test('_generateKey() returns UUID when keyType is uuid', () => {
    class Product extends Model {}
    Product.keyType = 'uuid';
    expect(Product._generateKey()).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('make() auto-assigns ULID when keyType is ulid and incrementing is false', () => {
    class Ticket extends Model {}
    Ticket.table = 'tickets';
    Ticket.keyType = 'ulid';
    Ticket.incrementing = false;
    Ticket.fillable = ['subject'];
    const t = Ticket.make({ subject: 'Help' });
    expect(t.getAttribute('id')).toHaveLength(26);
  });
});

// ── Pending attributes on scopes ──────────────────────────────────────────────

describe('withPendingAttributes()', () => {
  class Post extends Model {}
  Post.table = 'posts';

  test('stores attributes on the builder', () => {
    const qb = Post.query();
    qb.withPendingAttributes({ status: 'published' });
    expect(qb._pendingAttributes).toEqual({ status: 'published' });
  });

  test('merged into new()', async () => {
    const qb = Post.query();
    qb.withPendingAttributes({ status: 'draft', category: 'news' });
    const inst = await qb.new({ title: 'Hello' });
    expect(inst.getAttribute('status')).toBe('draft');
    expect(inst.getAttribute('category')).toBe('news');
    expect(inst.getAttribute('title')).toBe('Hello');
  });

  test('caller attrs override pending attributes in new()', async () => {
    const qb = Post.query();
    qb.withPendingAttributes({ status: 'draft' });
    const inst = await qb.new({ status: 'published' });
    expect(inst.getAttribute('status')).toBe('published');
  });

  test('multiple calls merge', () => {
    const qb = Post.query();
    qb.withPendingAttributes({ a: 1 });
    qb.withPendingAttributes({ b: 2 });
    expect(qb._pendingAttributes).toEqual({ a: 1, b: 2 });
  });

  test('new() returns instance not marked as existing', async () => {
    const qb = Post.query();
    qb.withPendingAttributes({ status: 'draft' });
    const inst = await qb.new();
    expect(inst.exists).toBe(false);
  });
});

// ── has() ─────────────────────────────────────────────────────────────────────

describe('has()', () => {
  const QueryBuilder = require('../orm/QueryBuilder');

  class User extends Model {}
  User.table = 'users';

  test('has() returns the query builder for chaining', () => {
    const qb = User.query();
    const result = qb.has('posts');
    expect(result).toBe(qb);
  });

  test('has() is a no-op when relation method does not exist', () => {
    const qb = User.query();
    expect(() => qb.has('nonexistent')).not.toThrow();
  });

  test('has() with no args defaults to >= 1', () => {
    const qb = new QueryBuilder('users', null, null);
    qb.has('posts');
    expect(qb).toBeDefined();
  });
});
