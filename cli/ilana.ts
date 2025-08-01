#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import Database from '../database/connection';
import MigrationRunner from '../orm/MigrationRunner';

interface ModelOptions {
  migration?: boolean;
  factory?: boolean;
  seed?: boolean;
  pivot?: boolean;
  all?: boolean;
}

// Default database configuration
const defaultConfig = {
  client: 'sqlite3' as const,
  connection: {
    filename: './database.sqlite'
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
function loadConfig() {
  const configPath = path.join(process.cwd(), 'ilana.config.js');
  if (fs.existsSync(configPath)) {
    delete require.cache[configPath];
    const config = require(configPath).default || require(configPath);
    // Config file already initializes database
    return config;
  }
  // Fallback to default and initialize
  Database.configure(defaultConfig);
  return defaultConfig;
}

// Initialize database
function initializeDatabase() {
  loadConfig(); // Config handles initialization
}

// Helper functions
function toPascalCase(str: string): string {
  return str.replace(/(^|_)(.)/g, (_, __, char) => char.toUpperCase());
}

function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function pluralize(str: string): string {
  if (str.endsWith('y')) return str.slice(0, -1) + 'ies';
  if (str.endsWith('s')) return str + 'es';
  return str + 's';
}

function generateModel(name: string, options: ModelOptions = {}): void {
  const className = toPascalCase(name);
  const tableName = pluralize(toSnakeCase(name));
  const fileName = `${className}.ts`;
  const filePath = path.join(process.cwd(), 'models', fileName);

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

function getModelTemplate(className: string, tableName: string): string {
  return `import Model from '../orm/Model';
// import { MoneyCast, EncryptedCast } from '../orm/CustomCasts';

export default class ${className} extends Model {
  protected static table = '${tableName}';
  protected static timestamps = true;
  protected static softDeletes = false;
  
  // For UUID primary keys, uncomment:
  // protected static keyType = 'string' as const;
  // protected static incrementing = false;

  protected fillable: string[] = [];
  protected hidden: string[] = [];
  protected casts = {
    // Basic casts
    // is_active: 'boolean' as const,
    // metadata: 'json' as const,
    // tags: 'array' as const,
    
    // Custom casts
    // price: new MoneyCast(),
    // secret: new EncryptedCast('your-key'),
  };

  // Define your attributes here
  id!: number; // Change to string for UUID
  created_at!: Date;
  updated_at!: Date;

  // Define relationships here
  // example() {
  //   return this.hasMany(RelatedModel, 'foreign_key');
  // }

  // Define scopes here
  // static scopeActive(query: any): void {
  //   query.where('is_active', true);
  // }
  
  // Register for polymorphic relationships
  // static {
  //   this.register();
  // }
}
`;
}

function getPivotModelTemplate(className: string, tableName: string): string {
  return `import Model from '../orm/Model';

export default class ${className} extends Model {
  protected static table = '${tableName}';
  protected static timestamps = true;
  
  protected fillable: string[] = [];

  // Pivot model attributes
  id!: number;
  created_at!: Date;
  updated_at!: Date;

  // Define pivot relationships here
}
`;
}

function generateFactory(className: string): void {
  const fileName = `${className}Factory.ts`;
  const filePath = path.join(process.cwd(), 'factories', fileName);

  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  const template = `import { defineFactory } from '../orm/Factory';
import ${className} from '../models/${className}';

export default defineFactory(${className}, (faker) => ({
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

function generateSeeder(className: string): void {
  const fileName = `${className}Seeder.ts`;
  const filePath = path.join(process.cwd(), 'seeds', fileName);

  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  const template = `import Seeder from '../orm/Seeder';
import ${className} from '../models/${className}';
import '../factories/${className}Factory';

export default class ${className}Seeder extends Seeder {
  async run(): Promise<void> {
    console.log('Seeding ${className.toLowerCase()}s...');

    // Create sample data
    await ${className}.factory().times(10).create();

    console.log('${className}s seeded successfully');
  }
}
`;

  fs.writeFileSync(filePath, template);
  console.log(`Created seeder: seeds/${fileName}`);
}

// CLI Commands
const commands = {
  async setup() {
    console.log('Setting up Ilana ORM...');
    
    // Create directories
    const dirs = ['models', 'migrations', 'factories', 'seeds'];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}/`);
      }
    }
    
    // Create config file if it doesn't exist
    const configPath = 'ilana.config.js';
    if (!fs.existsSync(configPath)) {
      const configTemplate = `const Database = require('ilana/database/connection').default;

const config = {
  default: 'sqlite',
  
  connections: {
    sqlite: {
      client: 'sqlite3',
      connection: {
        filename: './database.sqlite'
      }
    },
    
    // mysql: {
    //   client: 'mysql2',
    //   connection: {
    //     host: 'localhost',
    //     port: 3306,
    //     user: 'your_username',
    //     password: 'your_password',
    //     database: 'your_database'
    //   }
    // },
    
    // postgres: {
    //   client: 'pg',
    //   connection: {
    //     host: 'localhost',
    //     port: 5432,
    //     user: 'your_username',
    //     password: 'your_password',
    //     database: 'your_database'
    //   }
    // },
    
    // mysql_secondary: {
    //   client: 'mysql2',
    //   connection: {
    //     host: 'secondary.mysql.com',
    //     port: 3306,
    //     user: 'secondary_user',
    //     password: 'secondary_password',
    //     database: 'secondary_db'
    //   }
    // }
  },
  
  migrations: {
    directory: './migrations',
    tableName: 'migrations'
  },
  
  seeds: {
    directory: './seeds'
  }
};

// Auto-initialize database connections
Database.configure(config);

module.exports = config;
`;
      fs.writeFileSync(configPath, configTemplate);
      console.log(`Created config file: ${configPath}`);
    }
    
    // Create .env file if it doesn't exist
    const envPath = '.env';
    if (!fs.existsSync(envPath)) {
      const envTemplate = `# Database Configuration
DB_CONNECTION=sqlite
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=your_database
DB_USERNAME=your_username
DB_PASSWORD=your_password

# PostgreSQL
# DB_CONNECTION=postgres
# DB_HOST=localhost
# DB_PORT=5432
# DB_DATABASE=your_database
# DB_USERNAME=your_username
# DB_PASSWORD=your_password

# MySQL
# DB_CONNECTION=mysql
# DB_HOST=localhost
# DB_PORT=3306
# DB_DATABASE=your_database
# DB_USERNAME=your_username
# DB_PASSWORD=your_password
`;
      fs.writeFileSync(envPath, envTemplate);
      console.log(`Created environment file: ${envPath}`);
    }
    
    console.log('\nIlana ORM setup complete!');
    console.log('\nNext steps:');
    console.log('1. Update ilana.config.js connections and set your default');
    console.log('2. Uncomment and configure additional connections as needed');
    console.log('3. Run: ilana make:model User -m');
    console.log('4. Run: ilana migrate');
  },
  async 'make:migration'(name?: string, ...flags: string[]) {
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

    initializeDatabase();
    const runner = new MigrationRunner();
    runner.generateMigration(name, tableName, isCreate);
  },

  async 'make:factory'(name?: string) {
    if (!name) {
      console.error('Factory name is required');
      console.log('Usage: ilana make:factory <FactoryName>');
      process.exit(1);
    }

    const className = name.replace('Factory', '');
    generateFactory(className);
  },

  async 'make:seeder'(name?: string) {
    if (!name) {
      console.error('Seeder name is required');
      console.log('Usage: ilana make:seeder <SeederName>');
      process.exit(1);
    }

    const className = name.replace('Seeder', '');
    generateSeeder(className);
  },

  async 'make:model'(name?: string, ...flags: string[]) {
    if (!name) {
      console.error('Model name is required');
      console.log('Usage: ilana make:model <ModelName> [options]');
      process.exit(1);
    }

    const options: ModelOptions = {};
    
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
      initializeDatabase();
    }

    generateModel(name, options);
  },

  async migrate(...args: string[]) {
    initializeDatabase();
    const runner = new MigrationRunner();
    
    let connection: string | undefined;
    let onlyFile: string | undefined;
    let toFile: string | undefined;
    
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

  async 'migrate:fresh'(...args: string[]) {
    initializeDatabase();
    const runner = new MigrationRunner();
    
    let connection: string | undefined;
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

  async 'migrate:list'(connection?: string) {
    initializeDatabase();
    const runner = new MigrationRunner();
    await runner.list(connection);
    process.exit(0);
  },

  async 'migrate:unlock'(connection?: string) {
    initializeDatabase();
    const runner = new MigrationRunner();
    await runner.unlock(connection);
    process.exit(0);
  },

  async 'migrate:rollback'(...args: string[]) {
    initializeDatabase();
    const runner = new MigrationRunner();
    
    let steps = 1;
    let connection: string | undefined;
    let toFile: string | undefined;
    
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

  async 'migrate:reset'(connection?: string) {
    initializeDatabase();
    const runner = new MigrationRunner();
    await runner.reset(connection);
    process.exit(0);
  },

  async 'migrate:refresh'(connection?: string) {
    initializeDatabase();
    const runner = new MigrationRunner();
    await runner.refresh(connection);
    process.exit(0);
  },

  async 'migrate:status'(connection?: string) {
    initializeDatabase();
    const runner = new MigrationRunner();
    await runner.status(connection);
    process.exit(0);
  },

  async seed(...args: string[]) {
    initializeDatabase();
    
    let seederName: string | undefined;
    let connection: string | undefined;
    
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
    
    const seedsPath = path.join(process.cwd(), 'seeds');
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

  async 'db:seed'(seederName?: string) {
    return commands.seed(seederName);
  },

  async 'db:wipe'(connection?: string) {
    initializeDatabase();
    const runner = new MigrationRunner();
    await runner.wipe(connection);
    process.exit(0);
  },

  async 'make:observer'(name?: string, ...flags: string[]) {
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
    const fileName = `${className}Observer.ts`;
    const filePath = path.join(process.cwd(), 'observers', fileName);

    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }

    const importStatement = modelName ? `import ${modelName} from '../models/${modelName}';\n\n` : '';
    const modelType = modelName || 'any';

    const template = `${importStatement}export default class ${className}Observer {
  async creating(model: ${modelType}): Promise<void> {}
  async created(model: ${modelType}): Promise<void> {}
  async updating(model: ${modelType}): Promise<void> {}
  async updated(model: ${modelType}): Promise<void> {}
  async saving(model: ${modelType}): Promise<void> {}
  async saved(model: ${modelType}): Promise<void> {}
  async deleting(model: ${modelType}): Promise<void> {}
  async deleted(model: ${modelType}): Promise<void> {}
}
`;

    fs.writeFileSync(filePath, template);
    console.log(`Created observer: observers/${fileName}`);
    
    if (modelName) {
      console.log(`Observer configured for model: ${modelName}`);
    }
  },

  async 'make:cast'(name?: string) {
    if (!name) {
      console.error('Cast name is required');
      process.exit(1);
    }

    const className = toPascalCase(name.replace('Cast', ''));
    const fileName = `${className}Cast.ts`;
    const filePath = path.join(process.cwd(), 'casts', fileName);

    if (!fs.existsSync(path.dirname(filePath))) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }

    const template = `import { CustomCast } from '../orm/Model';

export default class ${className}Cast implements CustomCast {
  get(value: any): any {
    return value;
  }

  set(value: any): any {
    return value;
  }
}
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

  const commandHandler = commands[command as keyof typeof commands];
  
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

export default commands;