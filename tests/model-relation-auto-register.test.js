/**
 * Regression tests for lazy auto-registration of string-based relations.
 *
 * The docs recommend defining relations with string names
 * (`this.hasMany('Book')`) specifically to avoid circular imports, but
 * resolving a string relation requires the related class to already be in
 * ModelRegistry — previously that only happened via an explicit
 * `SomeModel.register()` call, which none of the non-polymorphic relationship
 * docs examples ever show. Calling `Author.with('posts').get()` would throw
 * `Model 'Book' not found. Make sure to call Book.register().` even though
 * neither Author nor Book was ever registered by hand.
 *
 * Model now auto-registers a class the first time it's actually queried or
 * constructed (see Model.js's `_autoRegister()`, called from `query()` and
 * the constructor). In any real app the related model gets used somewhere
 * (e.g. to create/find its own rows) before a relation to it is loaded, so
 * this removes the need for a manual `.register()` call in that common case.
 */

jest.resetModules();
jest.unmock('../database/connection');

const Database = require('../database/connection');
const Model = require('../orm/Model');
const ModelRegistry = require('../orm/ModelRegistry');

class Author extends Model {
  static table = 'ar_authors';
  static timestamps = false;

  books() {
    return this.hasMany('Book', 'author_id');
  }
}

class Book extends Model {
  static table = 'ar_books';
  static timestamps = false;

  author() {
    return this.belongsTo('Author', 'author_id');
  }
}

describe('lazy auto-registration of string-based relations', () => {
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
    await knex.schema.createTable('ar_authors', (t) => {
      t.increments('id');
      t.string('name');
    });
    await knex.schema.createTable('ar_books', (t) => {
      t.increments('id');
      t.string('title');
      t.integer('author_id');
    });
  });

  afterAll(async () => {
    await Database.connection('sqlite').destroy();
  });

  test('neither model is registered before it is used', () => {
    expect(ModelRegistry.has('Author')).toBe(false);
    expect(ModelRegistry.has('Book')).toBe(false);
  });

  test('creating rows auto-registers the classes as a side effect', async () => {
    const author = await Author.create({ name: 'Ada' });
    await Book.create({ title: 'Notes', author_id: author.getAttribute('id') });

    expect(ModelRegistry.get('Author')).toBe(Author);
    expect(ModelRegistry.get('Book')).toBe(Book);
  });

  test('a string-based hasMany relation resolves without an explicit .register() call', async () => {
    const author = await Author.with('books').first();
    expect(author.relations.books.map((b) => b.title)).toEqual(['Notes']);
  });

  test('a string-based belongsTo relation resolves without an explicit .register() call', async () => {
    const book = await Book.with('author').first();
    expect(book.relations.author.name).toBe('Ada');
  });
});
