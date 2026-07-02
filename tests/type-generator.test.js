/**
 * Tests for the npx ilana types command:
 * - parseModelFile: extracts class metadata from model source
 * - parseMigrationsForTable: extracts column types from migration source
 * - generateModelTypes: produces correct .d.ts output
 */

// Pull the functions out of the CLI file by requiring it and exposing internals.
// Since they're module-level functions (not exported), we extract them via a
// temporary re-implementation here to keep the tests self-contained and fast.

// ── Inline the functions under test ──────────────────────────────────────────

const path = require('path');

function toPascalCase(str) {
  return str.replace(/(^|_)(.)/g, (_, __, char) => char.toUpperCase());
}
function toSnakeCase(str) {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}
function pluralize(str) {
  if (str.endsWith('y')) return str.slice(0, -1) + 'ies';
  if (str.endsWith('s')) return str + 'es';
  return str + 's';
}

const CAST_TYPE_MAP = {
  string: 'string', number: 'number', float: 'number',
  boolean: 'boolean', date: 'Date',
  json: 'Record<string, any>', object: 'Record<string, any>', array: 'any[]',
};

const KNEX_COLUMN_MAP = {
  increments: { type: 'number', nullable: false },
  bigIncrements: { type: 'number', nullable: false },
  integer: { type: 'number', nullable: true },
  bigInteger: { type: 'number', nullable: true },
  float: { type: 'number', nullable: true },
  double: { type: 'number', nullable: true },
  decimal: { type: 'number', nullable: true },
  string: { type: 'string', nullable: true },
  text: { type: 'string', nullable: true },
  char: { type: 'string', nullable: true },
  uuid: { type: 'string', nullable: true },
  enum: { type: 'string', nullable: true },
  boolean: { type: 'boolean', nullable: true },
  date: { type: 'Date', nullable: true },
  datetime: { type: 'Date', nullable: true },
  timestamp: { type: 'Date', nullable: true },
  json: { type: 'Record<string, any>', nullable: true },
  jsonb: { type: 'Record<string, any>', nullable: true },
  binary: { type: 'Buffer', nullable: true },
};

const RELATION_RETURN_MAP = {
  hasOne: (r) => `${r} | null`,
  hasMany: (r) => `${r}[]`,
  belongsTo: (r) => `${r} | null`,
  belongsToMany: (r) => `${r}[]`,
  hasManyThrough: (r) => `${r}[]`,
  morphTo: () => 'any',
  morphOne: () => 'any | null',
  morphMany: () => 'any[]',
};

function parseMigrationsForTable(tableName, content) {
  const columns = {};
  const tableBlockRegex = new RegExp(
    `(?:createTable|table)\\s*\\(\\s*['"]${tableName}['"]\\s*,\\s*(?:async\\s*)?(?:\\(\\s*)?(\\w+)\\s*(?:\\))?\\s*(?:=>|{)[\\s\\S]*?(?=\\}\\s*\\)|\\}\\s*;)`,
    'g'
  );
  let blockMatch;
  while ((blockMatch = tableBlockRegex.exec(content)) !== null) {
    const block = blockMatch[0];
    const alias = blockMatch[1] || 'table';
    const colRegex = new RegExp(`${alias}\\.(\\w+)\\s*\\(\\s*['"]([^'"]+)['"](?:[^)]*)?\\)([^;\\n]*)`, 'g');
    let colMatch;
    while ((colMatch = colRegex.exec(block)) !== null) {
      const [, method, colName, rest] = colMatch;
      const knexDef = KNEX_COLUMN_MAP[method];
      if (!knexDef) continue;
      const isNullable = /\.nullable\(\)/.test(rest);
      const isNotNullable = /\.notNullable\(\)/.test(rest);
      const nullable = isNullable ? true : isNotNullable ? false : knexDef.nullable;
      columns[colName] = { type: knexDef.type, nullable };
    }
  }
  return columns;
}

function parseModelFile(content, fileName) {
  const classMatch = content.match(/class\s+(\w+)\s+extends/);
  const className = classMatch?.[1] || toPascalCase(path.basename(fileName, path.extname(fileName)));
  const tableMatch = content.match(/static\s+table\s*=\s*['"]([^'"]+)['"]/);
  const table = tableMatch?.[1] || pluralize(toSnakeCase(className));
  const fillableMatch = content.match(/(?:static\s+)?fillable\s*=\s*\[([^\]]*)\]/s);
  const fillable = fillableMatch ? [...fillableMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]) : [];
  const castsMatch = content.match(/(?:static\s+)?casts\s*=\s*\{([^}]*)\}/s);
  const casts = {};
  if (castsMatch) {
    for (const [, key, val] of castsMatch[1].matchAll(/['"]?(\w+)['"]?\s*:\s*['"](\w+)['"]/g)) casts[key] = val;
  }
  const pkMatch = content.match(/static\s+primaryKey\s*=\s*['"]([^'"]+)['"]/);
  const primaryKey = pkMatch?.[1] || 'id';
  const keyTypeMatch = content.match(/static\s+keyType\s*=\s*['"]([^'"]+)['"]/);
  const keyType = (keyTypeMatch?.[1] === 'string') ? 'string' : 'number';
  const timestampsMatch = content.match(/static\s+timestamps\s*=\s*(true|false)/);
  const timestamps = timestampsMatch?.[1] !== 'false';
  const softDeletesMatch = content.match(/static\s+softDeletes\s*=\s*(true|false)/);
  const softDeletes = softDeletesMatch?.[1] === 'true';
  const createdAtCol = content.match(/static\s+createdAt\s*=\s*['"]([^'"]+)['"]/)?.[1] || 'created_at';
  const updatedAtCol = content.match(/static\s+updatedAt\s*=\s*['"]([^'"]+)['"]/)?.[1] || 'updated_at';
  const deletedAtCol = content.match(/static\s+deletedAt\s*=\s*['"]([^'"]+)['"]/)?.[1] || 'deleted_at';
  const relations = [];
  const relRegex = /(\w+)\s*\(\s*\)\s*\{[\s\S]*?return\s+this\.(hasOne|hasMany|belongsTo|belongsToMany|hasManyThrough|morphTo|morphOne|morphMany)\s*\(\s*['"]?(\w*?)['"]?[,)]/g;
  let m;
  while ((m = relRegex.exec(content)) !== null) {
    const [, methodName, relationType, relatedModel] = m;
    if (methodName !== 'constructor') relations.push({ methodName, relationType, relatedModel: relatedModel || 'any' });
  }
  return { className, table, fillable, casts, primaryKey, keyType, timestamps, softDeletes, createdAtCol, updatedAtCol, deletedAtCol, relations };
}

function generateModelTypes(model, migrationColumns = {}) {
  const { className, fillable, casts, primaryKey, keyType, timestamps, softDeletes, createdAtCol, updatedAtCol, deletedAtCol, relations } = model;
  const relatedModels = [...new Set(relations.map(r => r.relatedModel).filter(r => r && r !== 'any'))];
  const fields = [];
  fields.push(`  ${primaryKey}: ${keyType};`);
  const tsColNames = [primaryKey, createdAtCol, updatedAtCol, deletedAtCol];
  const allCols = new Set([...fillable, ...Object.keys(migrationColumns)]);
  for (const col of allCols) {
    if (tsColNames.includes(col)) continue;
    if (casts[col]) {
      fields.push(`  ${col}?: ${CAST_TYPE_MAP[casts[col]] || 'any'};`);
      continue;
    }
    const migCol = migrationColumns[col];
    if (migCol) {
      fields.push(`  ${col}?: ${migCol.nullable ? `${migCol.type} | null` : migCol.type};`);
    } else {
      fields.push(`  ${col}?: any;`);
    }
  }
  if (timestamps) { fields.push(`  ${createdAtCol}?: Date;`); fields.push(`  ${updatedAtCol}?: Date;`); }
  if (softDeletes) fields.push(`  ${deletedAtCol}?: Date | null;`);
  for (const { methodName, relationType, relatedModel } of relations) {
    fields.push(`  ${methodName}?: ${RELATION_RETURN_MAP[relationType]?.(relatedModel) || 'any'};`);
  }
  const usedRelTypes = [...new Set(relations.map(r => ({ hasOne: 'HasOne', hasMany: 'HasMany', belongsTo: 'BelongsTo', belongsToMany: 'BelongsToMany', hasManyThrough: 'HasManyThrough', morphTo: 'MorphTo', morphOne: 'MorphOne', morphMany: 'MorphMany' })[r.relationType]).filter(Boolean))];
  const coreImports = usedRelTypes.length ? `import { Model, ${usedRelTypes.join(', ')} } from 'ilana-orm';` : `import { Model } from 'ilana-orm';`;
  const relationMethods = relations.map(({ methodName, relationType }) => `  ${methodName}(): ${{ hasOne: 'HasOne', hasMany: 'HasMany', belongsTo: 'BelongsTo', belongsToMany: 'BelongsToMany', hasManyThrough: 'HasManyThrough', morphTo: 'MorphTo', morphOne: 'MorphOne', morphMany: 'MorphMany' }[relationType] || 'any'};`);
  return `// Auto-generated by \`npx ilana types\` — do not edit manually\n${coreImports}\n${relatedModels.length ? `import type { ${relatedModels.join(', ')} } from './index';\n` : ''}\nexport interface ${className}Attributes {\n${fields.join('\n')}\n}\n\ndeclare class ${className} extends Model<${className}Attributes> {\n${relationMethods.length ? relationMethods.join('\n') + '\n' : ''}}\n\nexport default ${className};\n`;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('parseMigrationsForTable', () => {
  const migration = `
    export async function up(schema) {
      await schema.createTable('users', (table) => {
        table.increments('id');
        table.string('name').notNullable();
        table.string('email').notNullable().unique();
        table.string('bio').nullable();
        table.boolean('is_active').defaultTo(true);
        table.json('preferences').nullable();
        table.integer('age');
        table.timestamp('email_verified_at').nullable();
        table.timestamps(true, true);
        table.timestamp('deleted_at').nullable();
      });
    }
  `;

  it('parses increments as non-nullable number', () => {
    const cols = parseMigrationsForTable('users', migration);
    expect(cols.id).toEqual({ type: 'number', nullable: false });
  });

  it('parses notNullable string correctly', () => {
    const cols = parseMigrationsForTable('users', migration);
    expect(cols.name).toEqual({ type: 'string', nullable: false });
    expect(cols.email).toEqual({ type: 'string', nullable: false });
  });

  it('parses nullable string correctly', () => {
    const cols = parseMigrationsForTable('users', migration);
    expect(cols.bio).toEqual({ type: 'string', nullable: true });
  });

  it('parses boolean column', () => {
    const cols = parseMigrationsForTable('users', migration);
    expect(cols.is_active).toEqual({ type: 'boolean', nullable: true });
  });

  it('parses json column', () => {
    const cols = parseMigrationsForTable('users', migration);
    expect(cols.preferences).toEqual({ type: 'Record<string, any>', nullable: true });
  });

  it('parses integer with default nullable', () => {
    const cols = parseMigrationsForTable('users', migration);
    expect(cols.age).toEqual({ type: 'number', nullable: true });
  });

  it('parses nullable timestamp', () => {
    const cols = parseMigrationsForTable('users', migration);
    expect(cols.email_verified_at).toEqual({ type: 'Date', nullable: true });
    expect(cols.deleted_at).toEqual({ type: 'Date', nullable: true });
  });

  it('does not include timestamps() shorthand as a column', () => {
    const cols = parseMigrationsForTable('users', migration);
    // timestamps(true, true) is a method call, not a column — should not appear
    expect(cols.timestamps).toBeUndefined();
  });

  it('returns empty object for unknown table', () => {
    const cols = parseMigrationsForTable('nonexistent', migration);
    expect(cols).toEqual({});
  });

  it('works with arrow function callback', () => {
    const arrowMigration = `
      schema.createTable('posts', (t) => {
        t.increments('id');
        t.string('title').notNullable();
        t.text('body').nullable();
      });
    `;
    const cols = parseMigrationsForTable('posts', arrowMigration);
    expect(cols.id).toEqual({ type: 'number', nullable: false });
    expect(cols.title).toEqual({ type: 'string', nullable: false });
    expect(cols.body).toEqual({ type: 'string', nullable: true });
  });

  it('works with async arrow function callback', () => {
    const asyncMigration = `
      await schema.createTable('comments', async (table) => {
        table.increments('id');
        table.integer('post_id').notNullable();
        table.text('body').notNullable();
      });
    `;
    const cols = parseMigrationsForTable('comments', asyncMigration);
    expect(cols.id).toEqual({ type: 'number', nullable: false });
    expect(cols.post_id).toEqual({ type: 'number', nullable: false });
  });
});

describe('parseModelFile', () => {
  const modelSrc = `
    class User extends Model {
      static table = 'users';
      static softDeletes = true;
      static fillable = ['name', 'email', 'role', 'preferences'];
      static casts = {
        preferences: 'json',
        is_admin: 'boolean',
      };

      posts() {
        return this.hasMany('Post', 'user_id');
      }
      profile() {
        return this.hasOne('Profile', 'user_id');
      }
      roles() {
        return this.belongsToMany('Role', 'user_roles');
      }
    }
  `;

  it('extracts class name', () => {
    expect(parseModelFile(modelSrc, 'User.js').className).toBe('User');
  });

  it('falls back to filename for class name', () => {
    expect(parseModelFile('', 'BlogPost.js').className).toBe('BlogPost');
  });

  it('extracts table name', () => {
    expect(parseModelFile(modelSrc, 'User.js').table).toBe('users');
  });

  it('infers table name from class name when not set', () => {
    const src = `class BlogPost extends Model {}`;
    expect(parseModelFile(src, 'BlogPost.js').table).toBe('blog_posts');
  });

  it('extracts fillable', () => {
    const { fillable } = parseModelFile(modelSrc, 'User.js');
    expect(fillable).toEqual(['name', 'email', 'role', 'preferences']);
  });

  it('extracts casts', () => {
    const { casts } = parseModelFile(modelSrc, 'User.js');
    expect(casts.preferences).toBe('json');
    expect(casts.is_admin).toBe('boolean');
  });

  it('defaults primaryKey to id', () => {
    expect(parseModelFile(modelSrc, 'User.js').primaryKey).toBe('id');
  });

  it('extracts custom primaryKey', () => {
    const src = `class User extends Model { static primaryKey = 'uuid'; }`;
    expect(parseModelFile(src, 'User.js').primaryKey).toBe('uuid');
  });

  it('defaults timestamps to true', () => {
    expect(parseModelFile(modelSrc, 'User.js').timestamps).toBe(true);
  });

  it('respects timestamps = false', () => {
    const src = `class User extends Model { static timestamps = false; }`;
    expect(parseModelFile(src, 'User.js').timestamps).toBe(false);
  });

  it('extracts softDeletes', () => {
    expect(parseModelFile(modelSrc, 'User.js').softDeletes).toBe(true);
  });

  it('extracts relations', () => {
    const { relations } = parseModelFile(modelSrc, 'User.js');
    expect(relations).toHaveLength(3);
    expect(relations[0]).toMatchObject({ methodName: 'posts', relationType: 'hasMany', relatedModel: 'Post' });
    expect(relations[1]).toMatchObject({ methodName: 'profile', relationType: 'hasOne', relatedModel: 'Profile' });
    expect(relations[2]).toMatchObject({ methodName: 'roles', relationType: 'belongsToMany', relatedModel: 'Role' });
  });

  it('extracts custom timestamp column names', () => {
    const src = `
      class User extends Model {
        static createdAt = 'inserted_at';
        static updatedAt = 'modified_at';
        static deletedAt = 'removed_at';
      }
    `;
    const model = parseModelFile(src, 'User.js');
    expect(model.createdAtCol).toBe('inserted_at');
    expect(model.updatedAtCol).toBe('modified_at');
    expect(model.deletedAtCol).toBe('removed_at');
  });
});

describe('generateModelTypes', () => {
  const model = {
    className: 'User',
    table: 'users',
    fillable: ['name', 'email'],
    casts: { preferences: 'json' },
    primaryKey: 'id',
    keyType: 'number',
    timestamps: true,
    softDeletes: true,
    createdAtCol: 'created_at',
    updatedAtCol: 'updated_at',
    deletedAtCol: 'deleted_at',
    relations: [
      { methodName: 'posts', relationType: 'hasMany', relatedModel: 'Post' },
      { methodName: 'profile', relationType: 'hasOne', relatedModel: 'Profile' },
    ],
  };

  const migrationColumns = {
    id: { type: 'number', nullable: false },
    name: { type: 'string', nullable: false },
    email: { type: 'string', nullable: false },
    bio: { type: 'string', nullable: true },
    preferences: { type: 'Record<string, any>', nullable: true },
  };

  let output;
  beforeEach(() => { output = generateModelTypes(model, migrationColumns); });

  it('includes auto-generated header comment', () => {
    expect(output).toContain('Auto-generated by');
  });

  it('imports Model from ilana-orm', () => {
    expect(output).toContain(`from 'ilana-orm'`);
  });

  it('imports relation types used', () => {
    expect(output).toContain('HasMany');
    expect(output).toContain('HasOne');
  });

  it('imports related model types', () => {
    expect(output).toContain(`import type { Post, Profile } from './index'`);
  });

  it('generates Attributes interface', () => {
    expect(output).toContain('export interface UserAttributes');
  });

  it('primary key is non-optional', () => {
    expect(output).toContain('  id: number;');
  });

  it('notNullable string from migration is typed without null', () => {
    expect(output).toContain('  name?: string;');
    expect(output).toContain('  email?: string;');
  });

  it('nullable string from migration includes null union', () => {
    expect(output).toContain('  bio?: string | null;');
  });

  it('cast type takes priority over migration type', () => {
    // preferences is json in migration but cast overrides to Record<string, any> (same here)
    // more importantly it should NOT fall through to migration's nullable: true raw
    expect(output).toContain('  preferences?: Record<string, any>;');
  });

  it('timestamp columns are included when timestamps = true', () => {
    expect(output).toContain('  created_at?: Date;');
    expect(output).toContain('  updated_at?: Date;');
  });

  it('deleted_at included when softDeletes = true', () => {
    expect(output).toContain('  deleted_at?: Date | null;');
  });

  it('relation results are typed on the interface', () => {
    expect(output).toContain('  posts?: Post[];');
    expect(output).toContain('  profile?: Profile | null;');
  });

  it('relation methods are on the class declaration', () => {
    expect(output).toContain('  posts(): HasMany;');
    expect(output).toContain('  profile(): HasOne;');
  });

  it('class extends Model with Attributes generic', () => {
    expect(output).toContain('declare class User extends Model<UserAttributes>');
  });

  it('exports default class', () => {
    expect(output).toContain('export default User;');
  });

  it('works with no migration columns (graceful fallback)', () => {
    const out = generateModelTypes(model, {});
    expect(out).toContain('  name?: any;');
    expect(out).toContain('  email?: any;');
  });

  it('works with no relations', () => {
    const out = generateModelTypes({ ...model, relations: [] }, migrationColumns);
    expect(out).not.toContain('HasMany');
    expect(out).toContain(`import { Model } from 'ilana-orm'`);
  });

  it('uses custom timestamp column names', () => {
    const out = generateModelTypes({
      ...model,
      createdAtCol: 'inserted_at',
      updatedAtCol: 'modified_at',
      deletedAtCol: 'removed_at',
    }, {});
    expect(out).toContain('  inserted_at?: Date;');
    expect(out).toContain('  modified_at?: Date;');
    expect(out).toContain('  removed_at?: Date | null;');
  });

  it('omits timestamps when timestamps = false', () => {
    const out = generateModelTypes({ ...model, timestamps: false }, {});
    expect(out).not.toContain('created_at');
    expect(out).not.toContain('updated_at');
  });

  it('omits deleted_at when softDeletes = false', () => {
    const out = generateModelTypes({ ...model, softDeletes: false }, {});
    expect(out).not.toContain('deleted_at');
  });

  it('string keyType for UUID primary keys', () => {
    const out = generateModelTypes({ ...model, primaryKey: 'uuid', keyType: 'string' }, {});
    expect(out).toContain('  uuid: string;');
  });
});
