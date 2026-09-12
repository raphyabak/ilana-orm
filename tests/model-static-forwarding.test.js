/**
 * Regression tests for static QueryBuilder-method forwarding on Model.
 *
 * Previously only a hand-picked subset of QueryBuilder methods (with, findBy,
 * latest, ...) were exposed as statics on Model, forwarding to
 * `this.query().<method>()`. Anything else — including `where()`, the method
 * used in the docs' flagship example (`User.where('age', '>', 18).get()`) —
 * threw `TypeError: User.where is not a function` when called directly on a
 * Model subclass, even though `User.query().where(...)` worked fine.
 *
 * Model.js now wraps the exported class in a Proxy that auto-forwards any
 * unrecognized static call to `this.query()`, so this covers the whole class
 * of missing methods rather than just `where()`.
 */

const QueryBuilder = require('../orm/QueryBuilder');

describe('Model static QueryBuilder forwarding (mocked DB)', () => {
  const Model = require('../orm/Model');

  class User extends Model {
    static table = 'users';
  }

  test('User.where is a function (regression for the reported bug)', () => {
    expect(typeof User.where).toBe('function');
  });

  test('User.where(...) forwards to query().where(...) and returns a QueryBuilder', () => {
    const qb = User.where('age', '>', 18);
    expect(qb).toBeInstanceOf(QueryBuilder);
    expect(qb.query.where).toHaveBeenCalledWith('age', '>', 18);
  });

  test('other previously-missing QueryBuilder methods are forwarded too', () => {
    expect(typeof User.whereNull).toBe('function');
    expect(typeof User.whereNotNull).toBe('function');
    expect(typeof User.count).toBe('function');

    const qb = User.whereNull('deleted_at');
    expect(qb).toBeInstanceOf(QueryBuilder);
    expect(qb.query.whereNull).toHaveBeenCalledWith('deleted_at');
  });

  test('each forwarded call starts a fresh query (independent QueryBuilder instances)', () => {
    const qb1 = User.where('age', '>', 18);
    const qb2 = User.where('age', '<', 10);
    expect(qb1).not.toBe(qb2);
  });

  test('already-defined statics are not affected by the forwarding proxy', () => {
    expect(typeof User.find).toBe('function');
    expect(typeof User.with).toBe('function');
    expect(typeof User.query).toBe('function');
  });

  test('non-QueryBuilder static properties/methods still resolve normally', () => {
    expect(User.primaryKey).toBe('id');
    expect(User.someRandomUndefinedThing).toBeUndefined();
  });

  test('subclassing, instanceof, and construction are unaffected by the export Proxy', () => {
    expect(User.name).toBe('User');
    const instance = new User({ name: 'Alice' });
    expect(instance).toBeInstanceOf(User);
    expect(instance).toBeInstanceOf(Model);
  });
});

describe('Model static QueryBuilder forwarding (real sqlite DB)', () => {
  jest.resetModules();
  jest.unmock('../database/connection');

  const Database = require('../database/connection');
  const Model = require('../orm/Model');

  class User extends Model {
    static table = 'sf_users';
    static timestamps = false;
  }
  User.register();

  beforeAll(async () => {
    Database.configure({
      default: 'sqlite',
      connections: {
        sqlite: {
          client: 'sqlite3',
          useNullAsDefault: true,
          connection: { filename: ':memory:' },
          pool: { min: 1, max: 1 },
        },
      },
    });

    const knex = Database.connection('sqlite');
    await knex.schema.createTable('sf_users', (t) => {
      t.increments('id');
      t.string('name');
      t.integer('age');
      t.boolean('is_active');
    });

    await User.create({ name: 'Alice', age: 30, is_active: true });
    await User.create({ name: 'Bob', age: 15, is_active: true });
    await User.create({ name: 'Carol', age: 25, is_active: false });
  });

  afterAll(async () => {
    await Database.connection('sqlite').destroy();
  });

  test('the exact docs example works end-to-end: User.where(...).get()', async () => {
    const users = await User.where('age', '>', 18).get();
    expect(users.map((u) => u.name).sort()).toEqual(['Alice', 'Carol']);
  });

  test('chained forwarded where() calls combine correctly', async () => {
    const users = await User.where('age', '>', 18).where('is_active', true).get();
    expect(users.map((u) => u.name)).toEqual(['Alice']);
  });

  test('a forwarded terminal method (count) returns the right value', async () => {
    const count = await User.where('age', '>', 18).count();
    expect(count).toBe(2);
  });
});
