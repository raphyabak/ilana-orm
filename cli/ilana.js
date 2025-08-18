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
  return `import 'dotenv/config';
import Database from 'ilana-orm/database/connection';

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
    directory: './database/migrations',
    tableName: 'migrations'
  },
  
  seeds: {
    directory: './database/seeds'
  }
};

// Auto-initialize database connections
Database.configure(config);

export default config;
`;
}

function getCommonJSConfigTemplate() {
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
    directory: './database/migrations',
    tableName: 'migrations'
  },
  
  seeds: {
    directory: './database/seeds'
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
  const filePath = path.join(process.cwd(), 'models', fileName);

  if (fs.existsSync(filePath)) {
    console.error(`Model ${className} already exists at models/${fileName}`);
    process.exit(1);
  }

  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  const template = options.pivot ? getPivotModelTemplate(className, tableName) : getModelTemplate(className, tableName);
  fs.writeFileSync(filePath, template);
  console.log(`Created model: models/${fileName}`);

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
  const filePath = path.join(process.cwd(), 'database/factories', fileName);

  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  const template = isTypeScriptProject() ?
    `import { defineFactory } from 'ilana-orm/orm/Factory.js';
import ${className} from '../../models/${className}.js';

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
const ${className} = require('../../models/${className}');

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
  console.log(`Created factory: factories/${fileName}`);
}

function generateSeeder(className) {
  const fileName = `${className}Seeder${getFileExtension()}`;
  const filePath = path.join(process.cwd(), 'database/seeds', fileName);

  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  const template = isTypeScriptProject() ?
    `import Seeder from 'ilana-orm/orm/Seeder.js';
import ${className} from '../../models/${className}.js';
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
const ${className} = require('../../models/${className}');
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
  console.log(`Created seeder: seeds/${fileName}`);
}

// CLI Commands
const commands = {
  async setup() {
    console.log('Setting up Ilana ORM...');

    // Create directories
    const dirs = ['models', 'database/migrations', 'database/factories', 'database/seeds'];
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
  help                         Show this help message

Examples:
  ilana setup
  ilana make:model User -m
  ilana make:model Post --migration --factory
  ilana make:model UserRole -mfs
  ilana make:model Permission --all
  ilana make:model UserPost --pivot
  ilana make:migration create_users_table
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