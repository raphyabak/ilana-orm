#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Database = require('../database/connection');
const MigrationRunner = require('../orm/MigrationRunner');

// Default database configuration
const defaultConfig = {
  default: 'mysql',
  connections: {
    mysql: {
      client: 'mysql2',
      connection: {
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: '',
        database: 'ilana_orm'
      }
    }
  },
  migrations: {
    directory: './migrations',
    tableName: 'migrations'
  },
  seeds: {
    directory: './seeds'
  }
};

// Load configuration and auto-initialize
async function loadConfig() {
  const configPathJs = path.join(process.cwd(), 'ilana.config.js');
  const configPathMjs = path.join(process.cwd(), 'ilana.config.mjs');

  // Try .mjs first (ES modules)
  if (fs.existsSync(configPathMjs)) {
    try {
      const configModule = await import(configPathMjs);
      const config = configModule.default || configModule;
      return config;
    } catch (error) {
      console.error('Error loading ilana.config.mjs:', error.message);
      process.exit(1);
    }
  }

  // Try .js (CommonJS)
  if (fs.existsSync(configPathJs)) {
    delete require.cache[configPathJs];
    try {
      const config = require(configPathJs);
      return config;
    } catch (error) {
      if (error.code === 'ERR_REQUIRE_ESM') {
        console.error('Found ilana.config.js but project uses ES modules. Rename to ilana.config.mjs');
        process.exit(1);
      } else {
        throw error;
      }
    }
  }

  // No config file found
  console.error('No ilana.config.js or ilana.config.mjs found. Run "npx ilana setup" first.');
  process.exit(1);
}

// Initialize database
async function initializeDatabase() {
  await loadConfig(); // Config handles initialization
}

// Helper functions
function isTypeScriptProject() {
  return fs.existsSync(path.join(process.cwd(), 'tsconfig.json'));
}

function isESModuleProject() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      return packageJson.type === 'module';
    } catch (error) {
      return false;
    }
  }
  return false;
}

function getProjectStructure() {
  const hasSrc = fs.existsSync(path.join(process.cwd(), 'src'));
  return {
    hasSrc,
    modelsDir: hasSrc ? 'src/models' : 'models',
    databaseDir: hasSrc ? 'src/database' : 'database',
    observersDir: hasSrc ? 'src/observers' : 'observers',
    castsDir: hasSrc ? 'src/casts' : 'casts'
  };
}

function getFileExtension() {
  return isTypeScriptProject() ? '.ts' : '.js';
}

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

function getESModuleConfigTemplate() {
  const structure = getProjectStructure();
  return `import 'dotenv/config';
import Database from 'ilana-orm/database/connection.js';

const config = {
  default: process.env.DB_CONNECTION || 'mysql',
  timezone: process.env.DB_TIMEZONE || 'UTC',
  
  connections: {
    sqlite: {
      client: 'sqlite3',
      connection: {
        filename: process.env.DB_FILENAME || './database.sqlite'
      },
      useNullAsDefault: true
    },
    
    mysql: {
      client: 'mysql2',
      connection: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'your_database',
        timezone: process.env.DB_TIMEZONE || 'UTC'
      }
    },
    
    postgres: {
      client: 'pg',
      connection: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'your_database'
      }
    }
  },
  
  migrations: {
    directory: './${structure.databaseDir}/migrations',
    tableName: 'migrations'
  },
  
  seeds: {
    directory: './${structure.databaseDir}/seeds'
  }
};

// Auto-initialize database connections
Database.configure(config);

export default config;
`;
}

function getCommonJSConfigTemplate() {
  const structure = getProjectStructure();
  return `require('dotenv').config();
const Database = require('ilana-orm/database/connection');

const config = {
  default: process.env.DB_CONNECTION || 'mysql',
  timezone: process.env.DB_TIMEZONE || 'UTC',
  
  connections: {
    sqlite: {
      client: 'sqlite3',
      connection: {
        filename: process.env.DB_FILENAME || './database.sqlite'
      },
      useNullAsDefault: true
    },
    
    mysql: {
      client: 'mysql2',
      connection: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'your_database',
        timezone: process.env.DB_TIMEZONE || 'UTC'
      }
    },
    
    postgres: {
      client: 'pg',
      connection: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE || 'your_database'
      }
    }
  },
  
  migrations: {
    directory: './${structure.databaseDir}/migrations',
    tableName: 'migrations'
  },
  
  seeds: {
    directory: './${structure.databaseDir}/seeds'
  }
};

// Auto-initialize database connections
Database.configure(config);

module.exports = config;
`;
}

function generateModel(name, options = {}) {
  const className = toPascalCase(name);
  const tableName = pluralize(toSnakeCase(name));
  const fileName = `${className}${getFileExtension()}`;
  const structure = getProjectStructure();
  const filePath = path.join(process.cwd(), structure.modelsDir, fileName);

  if (fs.existsSync(filePath)) {
    console.error(`Model ${className} already exists at models/${fileName}`);
    process.exit(1);
  }

  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  const template = options.pivot ? getPivotModelTemplate(className, tableName) : getModelTemplate(className, tableName);
  fs.writeFileSync(filePath, template);
  console.log(`Created model: ${structure.modelsDir}/${fileName}`);

  if (options.migration || options.all) {
    const migrationName = `create_${tableName}_table`;
    const runner = new MigrationRunner();
    runner.generateMigration(migrationName);
  }

  if (options.factory || options.all) {
    generateFactory(className);
  }

  if (options.seed || options.all) {
    generateSeeder(className);
  }
}

function getModelTemplate(className, tableName) {
  const isESModule = isESModuleProject();

  if (isTypeScriptProject()) {
    return `import Model from 'ilana-orm/orm/Model';
// import { MoneyCast, EncryptedCast } from 'ilana-orm/orm/CustomCasts';

export default class ${className} extends Model {
  protected static table = '${tableName}';
  protected static timestamps = true;
  protected static softDeletes = false;
  
  // For UUID primary keys, uncomment:
  // protected static keyType = 'string' as const;
  // protected static incrementing = false;

  protected fillable: string[] = [];
  protected hidden: string[] = [];
  protected appends: string[] = [];
  protected casts = {
    // Basic casts
    // is_active: 'boolean' as const,
    // metadata: 'json' as const,
    // tags: 'array' as const,
    
    // Custom casts
    // price: new MoneyCast(),
    // secret: new EncryptedCast('your-key'),
  };

  // Define relationships here
  // example() {
  //   return this.hasMany(RelatedModel, 'foreign_key');
  // }

  // Define scopes here
  // static scopeActive(query: any) {
  //   query.where('is_active', true);
  // }
  
  // Register for polymorphic relationships
  // static {
  //   this.register();
  // }
}
`;
  }

  if (isESModule) {
    return `import Model from 'ilana-orm/orm/Model';
// import { MoneyCast, EncryptedCast } from 'ilana-orm/orm/CustomCasts';

class ${className} extends Model {
  static table = '${tableName}';
  static timestamps = true;
  static softDeletes = false;
  
  // For UUID primary keys, uncomment:
  // static keyType = 'string';
  // static incrementing = false;

  fillable = [];
  hidden = [];
  appends = [];
  casts = {
    // Basic casts
    // is_active: 'boolean',
    // metadata: 'json',
    // tags: 'array',
    
    // Custom casts
    // price: new MoneyCast(),
    // secret: new EncryptedCast('your-key'),
  };

  // Define relationships here
  // example() {
  //   return this.hasMany(RelatedModel, 'foreign_key');
  // }

  // Define scopes here
  // static scopeActive(query) {
  //   query.where('is_active', true);
  // }
  
  // Register for polymorphic relationships
  // static {
  //   this.register();
  // }
}

export default ${className};
`;
  }

  return `const Model = require('ilana-orm/orm/Model');
// const { MoneyCast, EncryptedCast } = require('ilana-orm/orm/CustomCasts');

class ${className} extends Model {
  static table = '${tableName}';
  static timestamps = true;
  static softDeletes = false;
  
  // For UUID primary keys, uncomment:
  // static keyType = 'string';
  // static incrementing = false;

  fillable = [];
  hidden = [];
  appends = [];
  casts = {
    // Basic casts
    // is_active: 'boolean',
    // metadata: 'json',
    // tags: 'array',
    
    // Custom casts
    // price: new MoneyCast(),
    // secret: new EncryptedCast('your-key'),
  };

  // Define relationships here
  // example() {
  //   return this.hasMany(RelatedModel, 'foreign_key');
  // }

  // Define scopes here
  // static scopeActive(query) {
  //   query.where('is_active', true);
  // }
  
  // Register for polymorphic relationships
  // static {
  //   this.register();
  // }
}

module.exports = ${className};
`;
}

function getPivotModelTemplate(className, tableName) {
  const isESModule = isESModuleProject();

  if (isTypeScriptProject()) {
    return `import Model from 'ilana-orm/orm/Model';

export default class ${className} extends Model {
  protected static table = '${tableName}';
  protected static timestamps = true;
  
  protected fillable: string[] = [];

  // Define pivot relationships here
}
`;
  }

  if (isESModule) {
    return `import Model from 'ilana-orm/orm/Model';

class ${className} extends Model {
  static table = '${tableName}';
  static timestamps = true;
  
  fillable = [];

  // Define pivot relationships here
}

export default ${className};
`;
  }

  return `const Model = require('ilana-orm/orm/Model');

class ${className} extends Model {
  static table = '${tableName}';
  static timestamps = true;
  
  fillable = [];

  // Define pivot relationships here
}

module.exports = ${className};
`;
}

function generateFactory(className) {
  const fileName = `${className}Factory${getFileExtension()}`;
  const structure = getProjectStructure();
  const filePath = path.join(process.cwd(), structure.databaseDir, 'factories', fileName);

  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  const modelPath = structure.hasSrc ? `../models/${className}.js` : `../../models/${className}.js`;
  const template = isTypeScriptProject() ?
    `import { defineFactory } from 'ilana-orm/orm/Factory.js';
import ${className} from '${modelPath}';

export default defineFactory(${className}, (faker) => ({
  // Define your factory attributes here
  // name: faker.person.fullName(),
  // email: faker.internet.email(),
}))
.state('example', (faker) => ({
  // Define state modifications here
}));
` :
    `const { defineFactory } = require('ilana-orm/orm/Factory');
const ${className} = require('${modelPath.replace('.js', '')}');

module.exports = defineFactory(${className}, (faker) => ({
  // Define your factory attributes here
  // name: faker.person.fullName(),
  // email: faker.internet.email(),
}))
.state('example', (faker) => ({
  // Define state modifications here
}));
`;

  fs.writeFileSync(filePath, template);
  console.log(`Created factory: ${structure.databaseDir}/factories/${fileName}`);
}

function generateSeeder(className) {
  const fileName = `${className}Seeder${getFileExtension()}`;
  const structure = getProjectStructure();
  const filePath = path.join(process.cwd(), structure.databaseDir, 'seeds', fileName);

  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  const modelPath = structure.hasSrc ? `../models/${className}.js` : `../../models/${className}.js`;
  const template = isTypeScriptProject() ?
    `import Seeder from 'ilana-orm/orm/Seeder.js';
import ${className} from '${modelPath}';
import '../factories/${className}Factory.js';

export default class ${className}Seeder extends Seeder {
  async run(): Promise<void> {
    console.log('Seeding ${className.toLowerCase()}s...');

    // Create sample data
    await ${className}.factory().times(10).create();

    console.log('${className}s seeded successfully');
  }
}
` :
    `const Seeder = require('ilana-orm/orm/Seeder');
const ${className} = require('${modelPath.replace('.js', '')}');
require('../factories/${className}Factory');

class ${className}Seeder extends Seeder {
  async run() {
    console.log('Seeding ${className.toLowerCase()}s...');

    // Create sample data
    await ${className}.factory().times(10).create();

    console.log('${className}s seeded successfully');
  }
}

module.exports = ${className}Seeder;
`;

  fs.writeFileSync(filePath, template);
  console.log(`Created seeder: ${structure.databaseDir}/seeds/${fileName}`);
}

function getObserverTemplate(className, modelName) {
  const isESModule = isESModuleProject();

  if (isTypeScriptProject()) {
    const importStatement = modelName ? `import ${modelName} from '../models/${modelName}.js';\n\n` : '';
    const modelType = modelName || 'any';

    return `${importStatement}export default class ${className}Observer {
  async creating(model: ${modelType}): Promise<void> {
    // Logic before creating model
  }

  async created(model: ${modelType}): Promise<void> {
    // Logic after creating model
  }

  async updating(model: ${modelType}): Promise<void> {
    // Logic before updating model
  }

  async updated(model: ${modelType}): Promise<void> {
    // Logic after updating model
  }

  async saving(model: ${modelType}): Promise<void> {
    // Logic before saving (create or update)
  }

  async saved(model: ${modelType}): Promise<void> {
    // Logic after saving (create or update)
  }

  async deleting(model: ${modelType}): Promise<void> {
    // Logic before deleting model
  }

  async deleted(model: ${modelType}): Promise<void> {
    // Logic after deleting model
  }

  async restoring(model: ${modelType}): Promise<void> {
    // Logic before restoring soft-deleted model
  }

  async restored(model: ${modelType}): Promise<void> {
    // Logic after restoring soft-deleted model
  }
}
`;
  }

  if (isESModule) {
    const importStatement = modelName ? `import ${modelName} from '../models/${modelName}.js';\n\n` : '';

    return `${importStatement}class ${className}Observer {
  async creating(model) {
    // Logic before creating model
  }

  async created(model) {
    // Logic after creating model
  }

  async updating(model) {
    // Logic before updating model
  }

  async updated(model) {
    // Logic after updating model
  }

  async saving(model) {
    // Logic before saving (create or update)
  }

  async saved(model) {
    // Logic after saving (create or update)
  }

  async deleting(model) {
    // Logic before deleting model
  }

  async deleted(model) {
    // Logic after deleting model
  }

  async restoring(model) {
    // Logic before restoring soft-deleted model
  }

  async restored(model) {
    // Logic after restoring soft-deleted model
  }
}

export default ${className}Observer;
`;
  }

  const importStatement = modelName ? `const ${modelName} = require('../models/${modelName}');\n\n` : '';

  return `${importStatement}class ${className}Observer {
  async creating(model) {
    // Logic before creating model
  }

  async created(model) {
    // Logic after creating model
  }

  async updating(model) {
    // Logic before updating model
  }

  async updated(model) {
    // Logic after updating model
  }

  async saving(model) {
    // Logic before saving (create or update)
  }

  async saved(model) {
    // Logic after saving (create or update)
  }

  async deleting(model) {
    // Logic before deleting model
  }

  async deleted(model) {
    // Logic after deleting model
  }

  async restoring(model) {
    // Logic before restoring soft-deleted model
  }

  async restored(model) {
    // Logic after restoring soft-deleted model
  }
}

module.exports = ${className}Observer;
`;
}

function getCastTemplate(className) {
  const isESModule = isESModuleProject();

  if (isTypeScriptProject()) {
    return `export default class ${className}Cast {
  get(value: any): any {
    // Transform value when retrieving from database
    return value;
  }

  set(value: any): any {
    // Transform value when storing to database
    return value;
  }
}
`;
  }

  if (isESModule) {
    return `class ${className}Cast {
  get(value) {
    // Transform value when retrieving from database
    return value;
  }

  set(value) {
    // Transform value when storing to database
    return value;
  }
}

export default ${className}Cast;
`;
  }

  return `class ${className}Cast {
  get(value) {
    // Transform value when retrieving from database
    return value;
  }

  set(value) {
    // Transform value when storing to database
    return value;
  }
}

module.exports = ${className}Cast;
`;
}


// ─── Type Generator ───────────────────────────────────────────────────────────

const CAST_TYPE_MAP = {
  string: 'string', number: 'number', float: 'number',
  boolean: 'boolean', date: 'Date',
  json: 'Record<string, any>', object: 'Record<string, any>', array: 'any[]',
};

// Knex column builder method → { tsType, nullable default }
const KNEX_COLUMN_MAP = {
  increments: { type: 'number', nullable: false },
  bigIncrements: { type: 'number', nullable: false },
  integer: { type: 'number', nullable: true },
  bigInteger: { type: 'number', nullable: true },
  tinyint: { type: 'number', nullable: true },
  smallint: { type: 'number', nullable: true },
  mediumint: { type: 'number', nullable: true },
  float: { type: 'number', nullable: true },
  double: { type: 'number', nullable: true },
  decimal: { type: 'number', nullable: true },
  string: { type: 'string', nullable: true },
  text: { type: 'string', nullable: true },
  mediumtext: { type: 'string', nullable: true },
  longtext: { type: 'string', nullable: true },
  char: { type: 'string', nullable: true },
  uuid: { type: 'string', nullable: true },
  enum: { type: 'string', nullable: true },
  set: { type: 'string', nullable: true },
  boolean: { type: 'boolean', nullable: true },
  date: { type: 'Date', nullable: true },
  datetime: { type: 'Date', nullable: true },
  timestamp: { type: 'Date', nullable: true },
  time: { type: 'string', nullable: true },
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

// Parse migration files to extract column definitions for a given table name
function parseMigrationsForTable(tableName, migrationsDir) {
  if (!fs.existsSync(migrationsDir)) return {};

  const columns = {};
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js') || f.endsWith('.mjs') || f.endsWith('.ts'))
    .sort(); // oldest first so later migrations can override

  for (const file of files) {
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    // Find createTable / table blocks for this table
    const tableBlockRegex = new RegExp(
      `(?:createTable|table)\\s*\\(\\s*['"]${tableName}['"]\\s*,\\s*(?:async\\s*)?(?:\\(\\s*)?(\\w+)\\s*(?:\\))?\\s*(?:=>|{)[\\s\\S]*?(?=\\}\\s*\\)|\\}\\s*;)`,
      'g'
    );

    let blockMatch;
    while ((blockMatch = tableBlockRegex.exec(content)) !== null) {
      const block = blockMatch[0];
      const alias = blockMatch[1] || 'table';

      // Match column definitions: table.string('col'), table.integer('col').nullable(), etc.
      const colRegex = new RegExp(
        `${alias}\\.(\\w+)\\s*\\(\\s*['"]([^'"]+)['"]([^)]*)\\)([^;\\n]*)`,
        'g'
      );

      let colMatch;
      while ((colMatch = colRegex.exec(block)) !== null) {
        const [, method, colName, args, rest] = colMatch;
        const knexDef = KNEX_COLUMN_MAP[method];
        if (!knexDef) continue;

        const isNullable = /\.nullable\(\)/.test(rest);
        const isNotNullable = /\.notNullable\(\)/.test(rest);
        const nullable = isNullable ? true : isNotNullable ? false : knexDef.nullable;

        // For enum columns, extract the values array and build a union type
        let tsType = knexDef.type;
        if (method === 'enum') {
          const valuesMatch = args.match(/\[([^\]]+)\]/);
          if (valuesMatch) {
            const values = [...valuesMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => `'${m[1]}'`);
            if (values.length) tsType = values.join(' | ');
          }
        }

        columns[colName] = { type: tsType, nullable };
      }
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
  const fillable = fillableMatch
    ? [...fillableMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1])
    : [];

  const castsMatch = content.match(/(?:static\s+)?casts\s*=\s*\{([^}]*)\}/s);
  const casts = {};
  if (castsMatch) {
    for (const [, key, val] of castsMatch[1].matchAll(/['"]?(\w+)['"]?\s*:\s*['"](\w+)['"]/g)) {
      casts[key] = val;
    }
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
    if (methodName !== 'constructor') {
      relations.push({ methodName, relationType, relatedModel: relatedModel || 'any' });
    }
  }

  return { className, table, fillable, casts, primaryKey, keyType, timestamps, softDeletes, createdAtCol, updatedAtCol, deletedAtCol, relations };
}

function generateModelTypes(model, migrationColumns = {}) {
  const { className, fillable, casts, primaryKey, keyType, timestamps, softDeletes, createdAtCol, updatedAtCol, deletedAtCol, relations } = model;

  const relatedModels = [...new Set(
    relations.map(r => r.relatedModel).filter(r => r && r !== 'any')
  )];

  const fields = [];

  // Primary key — always non-nullable
  fields.push(`  ${primaryKey}: ${keyType};`);

  // All columns known from migrations, minus pk and timestamp cols (handled separately)
  const tsColNames = [primaryKey, createdAtCol, updatedAtCol, deletedAtCol];
  const allCols = new Set([...fillable, ...Object.keys(migrationColumns)]);

  for (const col of allCols) {
    if (tsColNames.includes(col)) continue;

    // Cast takes priority over migration inference
    if (casts[col]) {
      const tsType = CAST_TYPE_MAP[casts[col]] || 'any';
      fields.push(`  ${col}?: ${tsType};`);
      continue;
    }

    const migCol = migrationColumns[col];
    if (migCol) {
      const tsType = migCol.nullable ? `${migCol.type} | null` : migCol.type;
      fields.push(`  ${col}?: ${tsType};`);
    } else {
      fields.push(`  ${col}?: any;`);
    }
  }

  if (timestamps) {
    fields.push(`  ${createdAtCol}?: Date;`);
    fields.push(`  ${updatedAtCol}?: Date;`);
  }

  if (softDeletes) {
    fields.push(`  ${deletedAtCol}?: Date | null;`);
  }

  for (const { methodName, relationType, relatedModel } of relations) {
    const returnType = RELATION_RETURN_MAP[relationType]?.(relatedModel) || 'any';
    fields.push(`  ${methodName}?: ${returnType};`);
  }

  const relationMethods = relations.map(({ methodName, relationType }) => {
    const map = { hasOne: 'HasOne', hasMany: 'HasMany', belongsTo: 'BelongsTo', belongsToMany: 'BelongsToMany', hasManyThrough: 'HasManyThrough', morphTo: 'MorphTo', morphOne: 'MorphOne', morphMany: 'MorphMany' };
    return `  ${methodName}(): ${map[relationType] || 'any'};`;
  });

  const usedRelTypes = [...new Set(relations.map(r => {
    const map = { hasOne: 'HasOne', hasMany: 'HasMany', belongsTo: 'BelongsTo', belongsToMany: 'BelongsToMany', hasManyThrough: 'HasManyThrough', morphTo: 'MorphTo', morphOne: 'MorphOne', morphMany: 'MorphMany' };
    return map[r.relationType];
  }).filter(Boolean))];

  const coreImports = usedRelTypes.length
    ? `import { Model, ${usedRelTypes.join(', ')} } from 'ilana-orm';`
    : `import { Model } from 'ilana-orm';`;

  return `// Auto-generated by \`npx ilana types\` — do not edit manually
${coreImports}
${relatedModels.length ? `import type { ${relatedModels.join(', ')} } from './index';\n` : ''}
export interface ${className}Attributes {
${fields.join('\n')}
}

declare class ${className} extends Model<${className}Attributes> {
${relationMethods.length ? relationMethods.join('\n') + '\n' : ''}
}

export default ${className};
`;
}

async function generateTypes(outDir) {
  // Only meaningful in TypeScript projects
  if (!isTypeScriptProject()) return;

  const structure = getProjectStructure();
  const modelsDir = path.join(process.cwd(), structure.modelsDir);
  const migrationsDir = path.join(process.cwd(), structure.databaseDir, 'migrations');

  if (!fs.existsSync(modelsDir)) return;

  const modelFiles = fs.readdirSync(modelsDir)
    .filter(f => f.endsWith('.js') || f.endsWith('.ts'))
    .filter(f => !f.endsWith('.d.ts'));

  if (modelFiles.length === 0) return;

  const outputDir = path.join(process.cwd(), outDir);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const classNames = [];

  for (const file of modelFiles) {
    const content = fs.readFileSync(path.join(modelsDir, file), 'utf8');
    const model = parseModelFile(content, file);
    const migrationColumns = parseMigrationsForTable(model.table, migrationsDir);
    const dts = generateModelTypes(model, migrationColumns);
    const outFile = path.join(outputDir, `${model.className}.d.ts`);
    fs.writeFileSync(outFile, dts);
    console.log(`  Generated: ${path.relative(process.cwd(), outFile)}`);
    classNames.push(model.className);
  }

  const indexContent = classNames
    .map(n => `export { default as ${n}, type ${n}Attributes } from './${n}';`)
    .join('\n') + '\n';
  fs.writeFileSync(path.join(outputDir, 'index.d.ts'), `// Auto-generated by \`npx ilana types\` — do not edit manually\n${indexContent}`);
  console.log(`  Generated: ${path.relative(process.cwd(), path.join(outputDir, 'index.d.ts'))}`);
  console.log(`\n✓ ${classNames.length} model type${classNames.length !== 1 ? 's' : ''} generated in ${outDir}/`);
}

// ─── Commands ─────────────────────────────────────────────────────────────────

const commands = {
  async setup() {
    console.log('Setting up Ilana ORM...');

    // Create directories
    const structure = getProjectStructure();
    const dirs = [
      structure.modelsDir,
      `${structure.databaseDir}/migrations`,
      `${structure.databaseDir}/factories`,
      `${structure.databaseDir}/seeds`
    ];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}/`);
      }
    }

    // Create config file if it doesn't exist
    const isESModule = isESModuleProject();
    const configPath = isESModule ? 'ilana.config.mjs' : 'ilana.config.js';

    if (!fs.existsSync(configPath)) {
      const configTemplate = isESModule ? getESModuleConfigTemplate() : getCommonJSConfigTemplate();
      fs.writeFileSync(configPath, configTemplate);
      console.log(`Created config file: ${configPath}`);
    }

    // Create .env file if it doesn't exist
    const envPath = '.env';
    if (!fs.existsSync(envPath)) {
      const envTemplate = `# Database Configuration
DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=your_database
DB_USERNAME=root
DB_PASSWORD=
DB_TIMEZONE=UTC

# SQLite Configuration
# DB_CONNECTION=sqlite
# DB_FILENAME=./database.sqlite

# MySQL Configuration (alternative)
# DB_HOST=localhost
# DB_PORT=3306
# DB_DATABASE=your_database
# DB_USERNAME=root
# DB_PASSWORD=
# DB_TIMEZONE=America/New_York

# PostgreSQL Configuration
# DB_CONNECTION=postgres
# DB_HOST=localhost
# DB_PORT=5432
# DB_DATABASE=your_database
# DB_USERNAME=postgres
# DB_PASSWORD=
# DB_TIMEZONE=Europe/London
`;
      fs.writeFileSync(envPath, envTemplate);
      console.log(`Created environment file: ${envPath}`);
    }

    console.log('\nIlana ORM setup complete!');
    console.log('\nNext steps:');
    console.log('1. Update .env file with your database credentials');
    console.log('2. Run: ilana make:model User -m');
    console.log('3. Run: ilana migrate');
  },

  async 'make:migration'(name, ...flags) {
    if (!name) {
      console.error('Migration name is required');
      console.log('Usage: ilana make:migration <name> [--table=table] [--create=table]');
      process.exit(1);
    }

    let tableName = '';
    let isCreate = false;

    for (const flag of flags) {
      if (flag.startsWith('--table=')) {
        tableName = flag.split('=')[1];
      } else if (flag.startsWith('--create=')) {
        tableName = flag.split('=')[1];
        isCreate = true;
      }
    }

    await initializeDatabase();
    const runner = new MigrationRunner();
    runner.generateMigration(name, tableName, isCreate);
  },

  async 'make:factory'(name) {
    if (!name) {
      console.error('Factory name is required');
      console.log('Usage: ilana make:factory <FactoryName>');
      process.exit(1);
    }

    const className = name.replace('Factory', '');
    generateFactory(className);
  },

  async 'make:seeder'(name) {
    if (!name) {
      console.error('Seeder name is required');
      console.log('Usage: ilana make:seeder <SeederName>');
      process.exit(1);
    }

    const className = name.replace('Seeder', '');
    generateSeeder(className);
  },

  async 'make:model'(name, ...flags) {
    if (!name) {
      console.error('Model name is required');
      console.log('Usage: ilana make:model <ModelName> [options]');
      process.exit(1);
    }

    // Validate model name format
    if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
      console.error('Model name must start with uppercase letter and contain only letters and numbers');
      console.error('Invalid: App_Post, App/Post, app_post');
      console.error('Valid: AppPost, User, BlogPost');
      process.exit(1);
    }

    const options = {};

    for (const flag of flags) {
      switch (flag) {
        case '-m':
        case '--migration':
          options.migration = true;
          break;
        case '-f':
        case '--factory':
          options.factory = true;
          break;
        case '-s':
        case '--seed':
          options.seed = true;
          break;
        case '-p':
        case '--pivot':
          options.pivot = true;
          break;
        case '-a':
        case '--all':
          options.all = true;
          break;
        case '-mfs':
          options.migration = true;
          options.factory = true;
          options.seed = true;
          break;
      }
    }

    if (options.migration || options.all) {
      await initializeDatabase();
    }

    generateModel(name, options);
    await generateTypes('types');
  },

  async migrate(...args) {
    await initializeDatabase();
    const runner = new MigrationRunner();

    let connection;
    let onlyFile;
    let toFile;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--connection' && args[i + 1]) {
        connection = args[i + 1];
        i++;
      } else if (arg.startsWith('--connection=')) {
        connection = arg.split('=')[1];
      } else if (arg === '--only' && args[i + 1]) {
        onlyFile = args[i + 1];
        i++;
      } else if (arg.startsWith('--only=')) {
        onlyFile = arg.split('=')[1];
      } else if (arg === '--to' && args[i + 1]) {
        toFile = args[i + 1];
        i++;
      } else if (arg.startsWith('--to=')) {
        toFile = arg.split('=')[1];
      } else if (!arg.startsWith('--')) {
        connection = arg;
      }
    }

    await runner.migrate(connection, onlyFile, toFile);
    await generateTypes('types');
    process.exit(0);
  },

  async 'migrate:fresh'(...args) {
    await initializeDatabase();
    const runner = new MigrationRunner();

    let connection;
    let withSeed = false;

    for (const arg of args) {
      if (arg === '--seed') {
        withSeed = true;
      } else if (arg.startsWith('--connection=')) {
        connection = arg.split('=')[1];
      } else if (!arg.startsWith('--')) {
        connection = arg;
      }
    }

    await runner.fresh(connection);

    if (withSeed) {
      await commands.seed();
    }

    await generateTypes('types');
    process.exit(0);
  },

  async 'migrate:list'(connection) {
    await initializeDatabase();
    const runner = new MigrationRunner();
    await runner.list(connection);
    process.exit(0);
  },

  async 'migrate:unlock'(connection) {
    await initializeDatabase();
    const runner = new MigrationRunner();
    await runner.unlock(connection);
    process.exit(0);
  },

  async 'migrate:rollback'(...args) {
    await initializeDatabase();
    const runner = new MigrationRunner();

    let steps = 1;
    let connection;
    let toFile;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--step' && args[i + 1]) {
        steps = parseInt(args[i + 1]);
        i++;
      } else if (arg.startsWith('--step=')) {
        steps = parseInt(arg.split('=')[1]);
      } else if (arg === '--connection' && args[i + 1]) {
        connection = args[i + 1];
        i++;
      } else if (arg.startsWith('--connection=')) {
        connection = arg.split('=')[1];
      } else if (arg === '--to' && args[i + 1]) {
        toFile = args[i + 1];
        i++;
      } else if (arg.startsWith('--to=')) {
        toFile = arg.split('=')[1];
      } else if (!isNaN(parseInt(arg))) {
        steps = parseInt(arg);
      } else if (!arg.startsWith('--')) {
        connection = arg;
      }
    }

    await runner.rollback(steps, connection, toFile);
    process.exit(0);
  },

  async 'migrate:reset'(connection) {
    await initializeDatabase();
    const runner = new MigrationRunner();
    await runner.reset(connection);
    process.exit(0);
  },

  async 'migrate:refresh'(connection) {
    await initializeDatabase();
    const runner = new MigrationRunner();
    await runner.refresh(connection);
    await generateTypes('types');
    process.exit(0);
  },

  async 'migrate:status'(connection) {
    await initializeDatabase();
    const runner = new MigrationRunner();
    await runner.status(connection);
    process.exit(0);
  },

  async seed(...args) {
    await initializeDatabase();

    let seederName;
    let connection;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--class' && args[i + 1]) {
        seederName = args[i + 1];
        i++;
      } else if (arg.startsWith('--class=')) {
        seederName = arg.split('=')[1];
      } else if (arg === '--connection' && args[i + 1]) {
        connection = args[i + 1];
        i++;
      } else if (arg.startsWith('--connection=')) {
        connection = arg.split('=')[1];
      } else if (!arg.startsWith('--')) {
        if (!seederName) seederName = arg;
        else connection = arg;
      }
    }

    const structure = getProjectStructure();
    const seedsPath = path.join(process.cwd(), structure.databaseDir, 'seeds');
    if (!fs.existsSync(seedsPath)) {
      console.log('No seeds directory found');
      process.exit(0);
    }

    const seedFiles = fs.readdirSync(seedsPath)
      .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
      .sort();

    if (seedFiles.length === 0) {
      console.log('No seed files found');
      process.exit(0);
    }

    const filesToRun = seederName
      ? seedFiles.filter(file => file.includes(seederName))
      : seedFiles;

    console.log(`Running ${filesToRun.length} seeders...`);

    for (const file of filesToRun) {
      console.log(`Seeding: ${file}`);
      const filepath = path.join(seedsPath, file);
      delete require.cache[filepath];
      const seederModule = require(filepath);
      const SeederClass = seederModule.default || seederModule;
      const seeder = new SeederClass();

      if (connection) {
        seeder.connection = connection;
      }

      if (typeof seeder.run === 'function') {
        await seeder.run();
      }

      console.log(`Seeded: ${file}`);
    }

    console.log('Seeding completed');
    process.exit(0);
  },

  async 'db:seed'(seederName) {
    return commands.seed(seederName);
  },

  async 'db:wipe'(connection) {
    await initializeDatabase();
    const runner = new MigrationRunner();
    await runner.wipe(connection);
    process.exit(0);
  },

  async 'make:observer'(name, ...flags) {
    if (!name) {
      console.error('Observer name is required');
      console.log('Usage: ilana make:observer <ObserverName> [--model=ModelName]');
      process.exit(1);
    }

    let modelName = '';

    for (const flag of flags) {
      if (flag.startsWith('--model=')) {
        modelName = flag.split('=')[1];
      }
    }

    const className = toPascalCase(name.replace('Observer', ''));
    const fileName = `${className}Observer${getFileExtension()}`;
    const structure = getProjectStructure();
    const filePath = path.join(process.cwd(), structure.observersDir, fileName);

    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }

    const template = getObserverTemplate(className, modelName);
    fs.writeFileSync(filePath, template);
    console.log(`Created observer: ${structure.observersDir}/${fileName}`);

    if (modelName) {
      console.log(`Observer configured for model: ${modelName}`);
    }
  },

  async types(...args) {
    if (!isTypeScriptProject()) {
      console.log('Skipping type generation — not a TypeScript project.');
      return;
    }
    let outDir = 'types';
    for (const arg of args) {
      if (arg.startsWith('--out=')) outDir = arg.split('=')[1];
      else if (!arg.startsWith('--')) outDir = arg;
    }
    console.log('Generating model types...\n');
    await generateTypes(outDir);
  },

  async 'make:cast'(name) {
    if (!name) {
      console.error('Cast name is required');
      console.log('Usage: ilana make:cast <CastName>');
      process.exit(1);
    }

    const className = toPascalCase(name.replace('Cast', ''));
    const fileName = `${className}Cast${getFileExtension()}`;
    const structure = getProjectStructure();
    const filePath = path.join(process.cwd(), structure.castsDir, fileName);

    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }

    const template = getCastTemplate(className);
    fs.writeFileSync(filePath, template);
    console.log(`Created cast: ${structure.castsDir}/${fileName}`);
  },

  help() {
    console.log(`
Ilana ORM CLI

Available commands:
  setup                        Initialize Ilana ORM project structure
  
  make:model <name> [options]  Create a new model
    -m, --migration           Generate migration
    -f, --factory            Generate factory
    -s, --seed               Generate seeder
    -p, --pivot              Generate pivot model
    -a, --all                Generate all (model + migration + factory + seeder)
    -mfs                     Generate model + migration + factory + seeder
  
  make:migration <name>        Create a new migration file
  make:factory <name>          Create a new factory
  make:seeder <name>           Create a new seeder
  make:observer <name>         Create a new observer
  make:cast <name>             Create a new cast
  
  migrate [connection]         Run all pending migrations
  migrate:rollback [steps]     Rollback the last batch of migrations
  migrate:reset [connection]   Rollback all migrations
  migrate:fresh [connection]   Drop all tables and re-run migrations
  migrate:refresh [connection] Reset and re-run all migrations
  migrate:status [connection]  Show migration status
  migrate:list [connection]    List completed migrations
  migrate:unlock [connection]  Unlock migrations (if stuck)
  
  seed [name]                  Run database seeders
  db:seed [name]               Alias for seed command
  db:wipe [connection]         Drop all tables

  types [--out=dir]            Generate TypeScript types for all models
                               Default output: types/

  help                         Show this help message

Examples:
  ilana setup
  ilana make:model User -m
  ilana make:model Post --migration --factory
  ilana make:model UserRole -mfs
  ilana make:model Permission --all
  ilana make:model UserPost --pivot
  ilana make:migration create_users_table
  ilana make:observer UserObserver --model=User
  ilana make:cast MoneyCast
  ilana migrate
  ilana migrate mysql
  ilana migrate:rollback 2 postgres
  ilana migrate:fresh --seed
  ilana seed UserSeeder
  ilana db:wipe
  ilana types
  ilana types --out=src/types
`);
  }
};

// Parse command line arguments
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const params = args.slice(1);

  if (!command || command === 'help') {
    commands.help();
    return;
  }

  const commandHandler = commands[command];

  if (!commandHandler) {
    console.error(`Unknown command: ${command}`);
    commands.help();
    process.exit(1);
  }

  try {
    await commandHandler(...params);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

// Run CLI
if (require.main === module) {
  main();
}

module.exports = commands;