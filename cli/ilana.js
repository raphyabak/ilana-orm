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
  },
};

function getESModuleConfigTemplate() {
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

    const seedsPath = path.join(process.cwd(), 'database/seeds');
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
      
      let seederModule;
      try {
        seederModule = require(filepath);
      } catch (error) {
        if (error.code === 'ERR_REQUIRE_ESM') {
          // Handle ES modules
          seederModule = await import(filepath);
        } else {
          throw error;
        }
      }
      
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
    const filePath = path.join(process.cwd(), 'observers', fileName);

    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }

    const template = isTypeScriptProject() ?
      `${modelName ? `import ${modelName} from '../models/${modelName}.js';\n\n` : ''}export default class ${className}Observer {
  async creating(model: ${modelName || 'any'}): Promise<void> {}
  async created(model: ${modelName || 'any'}): Promise<void> {}
  async updating(model: ${modelName || 'any'}): Promise<void> {}
  async updated(model: ${modelName || 'any'}): Promise<void> {}
  async saving(model: ${modelName || 'any'}): Promise<void> {}
  async saved(model: ${modelName || 'any'}): Promise<void> {}
  async deleting(model: ${modelName || 'any'}): Promise<void> {}
  async deleted(model: ${modelName || 'any'}): Promise<void> {}
}
` :
      `${modelName ? `const ${modelName} = require('../models/${modelName}');\n\n` : ''}class ${className}Observer {
  async creating(model) {}
  async created(model) {}
  async updating(model) {}
  async updated(model) {}
  async saving(model) {}
  async saved(model) {}
  async deleting(model) {}
  async deleted(model) {}
}

module.exports = ${className}Observer;
`;

    fs.writeFileSync(filePath, template);
    console.log(`Created observer: observers/${fileName}`);

    if (modelName) {
      console.log(`Observer configured for model: ${modelName}`);
    }
  },

  async 'make:cast'(name) {
    if (!name) {
      console.error('Cast name is required');
      process.exit(1);
    }

    const className = toPascalCase(name.replace('Cast', ''));
    const fileName = `${className}Cast${getFileExtension()}`;
    const filePath = path.join(process.cwd(), 'casts', fileName);

    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }

    const template = isTypeScriptProject() ?
      `import { CustomCast } from 'ilana-orm/orm/Model.js';

export default class ${className}Cast implements CustomCast {
  get(value: any): any {
    return value;
  }

  set(value: any): any {
    return value;
  }
}
` :
      `class ${className}Cast {
  get(value) {
    return value;
  }

  set(value) {
    return value;
  }
}

module.exports = ${className}Cast;
`;

    fs.writeFileSync(filePath, template);
    console.log(`Created cast: casts/${fileName}`);
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
  migrate [connection]         Run all pending migrations
  migrate:rollback [steps] [connection]  Rollback the last batch of migrations
  migrate:reset [connection]   Rollback all migrations
  migrate:refresh [connection] Reset and re-run all migrations
  migrate:status [connection]  Show migration status
  seed [name]                  Run database seeders
  db:seed [name]               Alias for seed command
  help                         Show this help message

Examples:
  ilana setup
  ilana make:model User -m
  ilana make:model Post --migration --factory
  ilana make:model UserRole -mfs
  ilana make:model Permission --all
  ilana make:model UserPost --pivot
  ilana make:migration create_users_table
  ilana migrate
  ilana migrate mysql
  ilana migrate:rollback 2 postgres
  ilana seed UserSeeder
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