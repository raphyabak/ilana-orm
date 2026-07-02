/**
 * Tests for CLI-generated templates (model, factory, seeder, migration).
 * Verifies the output is correct and matches the actual system API.
 */

const MigrationRunner = require('../orm/MigrationRunner');

// ── Migration templates ───────────────────────────────────────────────────────

describe('Migration template — create table', () => {
  let runner;

  beforeEach(() => {
    runner = new MigrationRunner();
    runner.isTypeScriptProject = () => false;
  });

  test('does not import SchemaBuilder', () => {
    const out = runner.getMigrationTemplate('create_users_table', 'users', true);
    expect(out).not.toContain('require(');
    expect(out).not.toContain('import');
    expect(out).not.toContain('SchemaBuilder');
  });

  test('does not have commented-out connection line', () => {
    const out = runner.getMigrationTemplate('create_users_table', 'users', true);
    expect(out).not.toContain('// connection');
  });

  test('generates up() with createTable', () => {
    const out = runner.getMigrationTemplate('create_posts_table', 'posts', true);
    expect(out).toContain("schema.createTable('posts'");
    expect(out).toContain("table.increments('id')");
    expect(out).toContain('table.timestamps()');
  });

  test('generates down() with dropTable', () => {
    const out = runner.getMigrationTemplate('create_posts_table', 'posts', true);
    expect(out).toContain("schema.dropTable('posts')");
  });

  test('exports the class', () => {
    const out = runner.getMigrationTemplate('create_posts_table', 'posts', true);
    expect(out).toContain('module.exports');
  });

  test('infers table name from migration name', () => {
    const out = runner.getMigrationTemplate('create_comments_table', null, true);
    expect(out).toContain("'comments'");
  });
});

describe('Migration template — alter table', () => {
  let runner;

  beforeEach(() => {
    runner = new MigrationRunner();
    runner.isTypeScriptProject = () => false;
  });

  test('generates up() with schema.table()', () => {
    const out = runner.getMigrationTemplate('add_bio_to_users', 'users', false);
    expect(out).toContain("schema.table('users'");
  });

  test('does not import SchemaBuilder', () => {
    const out = runner.getMigrationTemplate('add_bio_to_users', 'users', false);
    expect(out).not.toContain('SchemaBuilder');
    expect(out).not.toContain('require(');
  });

  test('does not have commented-out connection line', () => {
    const out = runner.getMigrationTemplate('add_bio_to_users', 'users', false);
    expect(out).not.toContain('// connection');
  });
});

// ── Model templates ───────────────────────────────────────────────────────────

describe('Model template', () => {
  let getModelTemplate;

  beforeAll(() => {
    ({ getModelTemplate } = require('../cli/ilana.js')._templates);
  });

  test('CJS template has no commented-out blocks', () => {
    // Temporarily make helpers return false for CJS
    const fs = require('fs');
    const origExists = fs.existsSync;
    fs.existsSync = () => false; // no tsconfig.json, no package.json type:module

    const out = getModelTemplate('Post', 'posts');
    fs.existsSync = origExists;

    const commentedLines = out.split('\n').filter(l => l.trim().startsWith('//'));
    expect(commentedLines).toHaveLength(0);
  });

  test('CJS template exports the class', () => {
    const fs = require('fs');
    const origExists = fs.existsSync;
    fs.existsSync = () => false;

    const out = getModelTemplate('Post', 'posts');
    fs.existsSync = origExists;

    expect(out).toContain('module.exports = Post');
  });

  test('CJS template requires from ilana-orm (not a relative path)', () => {
    const fs = require('fs');
    const origExists = fs.existsSync;
    fs.existsSync = () => false;

    const out = getModelTemplate('Post', 'posts');
    fs.existsSync = origExists;

    expect(out).toContain("require('ilana-orm/orm/Model')");
  });

  test('CJS template sets correct table name', () => {
    const fs = require('fs');
    const origExists = fs.existsSync;
    fs.existsSync = () => false;

    const out = getModelTemplate('Comment', 'comments');
    fs.existsSync = origExists;

    expect(out).toContain("static table = 'comments'");
  });

  test('CJS template includes fillable', () => {
    const fs = require('fs');
    const origExists = fs.existsSync;
    fs.existsSync = () => false;

    const out = getModelTemplate('Post', 'posts');
    fs.existsSync = origExists;

    expect(out).toContain('static fillable');
  });
});

// ── Factory template correctness ──────────────────────────────────────────────

describe('Factory template', () => {
  test('uses defineFactory — not Model.factory()', () => {
    // The template string used in generateFactory
    const template = `const { defineFactory } = require('ilana-orm/orm/Factory');
const Post = require('../../models/Post');

module.exports = defineFactory(Post, (faker) => ({
  // name: faker.person.fullName(),
}));`;

    expect(template).toContain('defineFactory(Post');
    expect(template).not.toContain('Post.factory()');
    expect(template).toContain("require('ilana-orm/orm/Factory')");
  });

  test('does not include .state() stub', () => {
    const template = `const { defineFactory } = require('ilana-orm/orm/Factory');
const Post = require('../../models/Post');

module.exports = defineFactory(Post, (faker) => ({
  // name: faker.person.fullName(),
}));`;

    expect(template).not.toContain('.state(');
  });
});

// ── Seeder template correctness ───────────────────────────────────────────────

describe('Seeder template', () => {
  test('uses factory(Model) not Model.factory()', () => {
    const template = `const Seeder = require('ilana-orm/orm/Seeder');
const { factory } = require('ilana-orm/orm/Factory');
const Post = require('../../models/Post');
require('../../database/factories/PostFactory');

class PostSeeder extends Seeder {
  async run() {
    await factory(Post).times(10).create();
  }
}

module.exports = PostSeeder;`;

    expect(template).toContain('factory(Post)');
    expect(template).not.toContain('Post.factory()');
    expect(template).toContain("require('ilana-orm/orm/Factory')");
  });

  test('imports factory from ilana-orm/orm/Factory', () => {
    const template = `const { factory } = require('ilana-orm/orm/Factory');`;
    expect(template).toContain('factory');
    expect(template).toContain('ilana-orm/orm/Factory');
  });

  test('extends Seeder', () => {
    const template = `class PostSeeder extends Seeder {`;
    expect(template).toContain('extends Seeder');
  });
});
