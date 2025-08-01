<div align="center">
  <img src="ilana.png" alt="IlanaORM Logo" width="200" height="200">
  <h1>IlanaORM</h1>
</div>

**Ìlànà** (pronounced "ee-LAH-nah") - A Yoruba word meaning "pattern," "system," or "protocol."

A fully-featured, Eloquent-style ORM for Node.js with TypeScript support. IlanaORM provides complete feature parity with Laravel's Eloquent ORM, following established patterns and protocols for database interaction, modeling, querying, relationships, events, casting, migrations, and more.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [CLI Commands](#cli-commands)
- [Models](#models)
- [Query Builder](#query-builder)
- [Relationships](#relationships)
- [Migrations](#migrations)
- [Seeders](#seeders)
- [Model Factories](#model-factories)
- [Advanced Features](#advanced-features)
- [TypeScript Support](#typescript-support)
- [Performance & Best Practices](#performance--best-practices)
- [Testing](#testing)

## Features

### 🏗️ **Active Record Pattern**
- Full CRUD operations with intuitive, chainable API
- Model-based database interactions
- Automatic table mapping and attribute handling
- Built-in validation and mass assignment protection

### 🔗 **Advanced Relationships**
- **One-to-One**: `hasOne()`, `belongsTo()`
- **One-to-Many**: `hasMany()`, `belongsTo()`
- **Many-to-Many**: `belongsToMany()` with pivot tables
- **Polymorphic**: `morphTo()`, `morphOne()`, `morphMany()`
- **Has-Many-Through**: Complex nested relationships
- **Eager Loading**: Prevent N+1 queries with `with()`
- **Lazy Loading**: Load relations on-demand

### 🔍 **Fluent Query Builder**
- Chainable methods for complex queries
- Raw SQL support when needed
- Subqueries and joins
- Aggregation functions (count, sum, avg, min, max)
- Conditional queries with `when()`
- Query scopes for reusable logic

### 🗄️ **Database Management**
- **Migrations**: Version control for database schema
- **Schema Builder**: Create, modify, drop tables and columns
- **Seeders**: Populate database with test/initial data
- **Multiple Connections**: Support for multiple databases

### 🏭 **Model Factories**
- Generate realistic test data with Faker.js
- Model states for different scenarios
- Relationship factories for complex data structures

### ⏰ **Lifecycle Management**
- **Soft Deletes**: Mark records as deleted without removal
- **Timestamps**: Automatic `created_at` and `updated_at`
- **Model Events**: Hook into model lifecycle
- **Observers**: Organize event handling logic

### 🛡️ **Type Safety & Developer Experience**
- **TypeScript First**: Complete type safety out of the box
- **IntelliSense Support**: Full IDE autocompletion
- **CLI Tools**: Code generation and database management
- **UUID Support**: Non-incrementing primary keys

### 🗃️ **Database Support**
- **PostgreSQL**: Full support with advanced features
- **MySQL/MariaDB**: Complete compatibility
- **SQLite**: Perfect for development and testing

## Installation

```bash
# npm
npm install ilana-orm

# yarn
yarn add ilana-orm

# pnpm
pnpm add ilana-orm
```

### Dependencies

Install your preferred database driver:

```bash
# PostgreSQL
npm install pg @types/pg
yarn add pg @types/pg
pnpm add pg @types/pg

# MySQL/MariaDB
npm install mysql2
yarn add mysql2
pnpm add mysql2

# SQLite
npm install sqlite3
yarn add sqlite3
pnpm add sqlite3
```

## Quick Start

### 1. Initialize Project

#### Automatic Setup (Recommended)

```bash
# Initialize IlanaORM in your project
npx ilana setup
```

This command will:
- Create the `ilana.config.js` configuration file
- Generate the `migrations/` directory
- Generate the `seeds/` directory
- Generate the `models/` directory
- Generate the `factories/` directory
- Create a sample `.env` file with database variables

#### Manual Setup

If you prefer not to run the setup command, you can manually create the required files and directories:

```bash
# Create directories
mkdir migrations seeds models factories

# Create config file (see configuration section below)
touch ilana.config.js
```

### 2. Configure Database

Create `ilana.config.js` in your project root:

```javascript
module.exports = {
  default: 'sqlite',
  
  connections: {
    sqlite: {
      client: 'sqlite3',
      connection: {
        filename: './database.sqlite'
      }
    },
    
    mysql: {
      client: 'mysql2',
      connection: {
        host: 'localhost',
        port: 3306,
        user: 'your_username',
        password: 'your_password',
        database: 'your_database'
      }
    },
    
    postgres: {
      client: 'pg',
      connection: {
        host: 'localhost',
        port: 5432,
        user: 'your_username',
        password: 'your_password',
        database: 'your_database'
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
```

### 3. Create Your First Model

```bash
# Generate model with migration
ilana make:model User --migration
```

This creates:
- `models/User.ts` - The model file
- `migrations/xxxx_create_users_table.ts` - Migration file

### 4. Define the Model

```typescript
// models/User.ts
import { Model } from 'ilana-orm';

export default class User extends Model {
  protected static table = 'users';
  
  protected fillable = ['name', 'email', 'password'];
  protected hidden = ['password'];
  protected casts = {
    email_verified_at: 'date' as const
  };

  // Relationships
  posts() {
    return this.hasMany(Post, 'user_id');
  }
}
```

### 5. Run Migration

```bash
ilana migrate
```

### 6. Start Using the Model

```typescript
import User from './models/User';

// Create user
const user = await User.create({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'secret'
});

// Query users
const users = await User.query()
  .where('is_active', true)
  .orderBy('created_at', 'desc')
  .get();

// Update user
await user.update({ name: 'John Smith' });

// Delete user
await user.delete();
```

## Configuration

### Complete Configuration Options

```javascript
// ilana.config.js
module.exports = {
  // Default connection name
  default: 'mysql_primary',
  
  // Database connections
  connections: {
    mysql_primary: {
      client: 'mysql2',
      connection: {
        host: 'primary.mysql.com',
        port: 3306,
        user: 'primary_user',
        password: 'primary_password',
        database: 'primary_db',
        charset: 'utf8mb4',
        timezone: 'UTC'
      },
      pool: {
        min: 2,
        max: 10,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 100
      },
      migrations: {
        tableName: 'migrations',
        directory: './migrations'
      },
      seeds: {
        directory: './seeds'
      }
    },
    
    postgres_analytics: {
      client: 'pg',
      connection: {
        host: 'analytics.postgres.com',
        port: 5432,
        user: 'analytics_user',
        password: 'analytics_password',
        database: 'analytics_db',
        ssl: { rejectUnauthorized: false },
        searchPath: ['public', 'analytics']
      },
      pool: {
        min: 1,
        max: 5
      },
      migrations: {
        tableName: 'analytics_migrations',
        directory: './migrations/analytics',
        schemaName: 'analytics'
      }
    },
    
    sqlite_test: {
      client: 'sqlite3',
      connection: {
        filename: './test.sqlite'
      },
      useNullAsDefault: true,
      migrations: {
        directory: './migrations/test'
      }
    }
  },
  
  // Global migration settings
  migrations: {
    directory: './migrations',
    tableName: 'migrations',
    schemaName: 'public', // PostgreSQL only
    extension: 'ts', // or 'js'
    loadExtensions: ['.ts', '.js'],
    sortDirsSeparately: false,
    stub: './migration-stub.ts' // Custom migration template
  },
  
  // Global seed settings
  seeds: {
    directory: './seeds',
    extension: 'ts',
    loadExtensions: ['.ts', '.js'],
    stub: './seed-stub.ts' // Custom seed template
  },
  
  // Model settings
  models: {
    directory: './models',
    extension: 'ts'
  },
  
  // Factory settings
  factories: {
    directory: './factories',
    extension: 'ts'
  },
  
  // Debugging
  debug: process.env.NODE_ENV === 'development',
  
  // Logging
  log: {
    warn(message) {
      console.warn(message);
    },
    error(message) {
      console.error(message);
    },
    deprecate(message) {
      console.warn('DEPRECATED:', message);
    },
    debug(message) {
      if (process.env.NODE_ENV === 'development') {
        console.log('DEBUG:', message);
      }
    }
  }
};
```

### Environment Variables

```bash
# .env
DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=your_database
DB_USERNAME=your_username
DB_PASSWORD=your_password
```

```javascript
// ilana.config.js with environment variables
module.exports = {
  default: process.env.DB_CONNECTION || 'sqlite',
  
  connections: {
    mysql: {
      client: 'mysql2',
      connection: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE
      }
    }
  }
};
```

## CLI Commands

IlanaORM provides a comprehensive CLI for managing your database and models:

### Model Generation
```bash
# Generate a model
ilana make:model User

# Generate model with migration
ilana make:model User --migration
ilana make:model User -m

# Generate model with factory
ilana make:model User --factory
ilana make:model User -f

# Generate model with seeder
ilana make:model User --seed
ilana make:model User -s

# Generate model with all extras
ilana make:model User --all
ilana make:model User -a

# Generate pivot model
ilana make:model UserRole --pivot
```

### Migration Commands
```bash
# Create migration
ilana make:migration create_users_table
ilana make:migration add_column_to_users --table=users
ilana make:migration create_posts_table --create=posts

# Run migrations
ilana migrate
ilana migrate --connection=mysql
ilana migrate --connection=postgres_analytics

# Run specific migration file
ilana migrate --only=20231201_create_users_table.ts

# Run migrations up to specific batch
ilana migrate --to=20231201_120000

# Rollback migrations
ilana migrate:rollback
ilana migrate:rollback --step=2
ilana migrate:rollback --to=20231201_120000
ilana migrate:rollback --connection=postgres_analytics

# Reset all migrations
ilana migrate:reset
ilana migrate:reset --connection=mysql

# Fresh migration (drop all + migrate)
ilana migrate:fresh
ilana migrate:fresh --connection=postgres_analytics

# Fresh with seeding
ilana migrate:fresh --seed
ilana migrate:fresh --seed --connection=mysql

# Check migration status
ilana migrate:status
ilana migrate:status --connection=postgres_analytics

# List completed migrations
ilana migrate:list

# Unlock migrations (if stuck)
ilana migrate:unlock
```

### Seeder Commands
```bash
# Create seeder
ilana make:seeder UserSeeder

# Run all seeders
ilana seed

# Run specific seeder
ilana seed --class=UserSeeder

# Run seeders for specific connection
ilana seed --connection=mysql
```

### Factory Commands
```bash
# Create factory
ilana make:factory UserFactory
```

### Database Commands
```bash
# Drop all tables
ilana db:wipe

# Run all seeders
ilana db:seed
```

### Observer Commands
```bash
# Create model observer
ilana make:observer UserObserver

# Create observer for specific model
ilana make:observer UserObserver --model=User
ilana make:observer PostObserver --model=Post
```

### Cast Commands
```bash
# Create custom cast
ilana make:cast MoneyCast
```

## Models

### Basic Model Definition

```typescript
import { Model } from 'ilana-orm';

export default class User extends Model {
  // Table configuration
  protected static table = 'users';
  protected static primaryKey = 'id';
  protected static keyType = 'number' as const; // or 'string' for UUID
  protected static incrementing = true;
  
  // Connection (optional)
  protected static connection = 'mysql';
  
  // Timestamps
  protected static timestamps = true;
  protected static createdAt = 'created_at';
  protected static updatedAt = 'updated_at';
  
  // Soft deletes
  protected static softDeletes = true;
  protected static deletedAt = 'deleted_at';
  
  // Mass assignment protection
  protected fillable = ['name', 'email', 'password'];
  protected guarded = ['id', 'created_at', 'updated_at'];
  
  // Hidden attributes (won't appear in JSON)
  protected hidden = ['password', 'remember_token'];
  
  // Attribute casting
  protected casts = {
    email_verified_at: 'date' as const,
    preferences: 'json' as const,
    is_admin: 'boolean' as const
  };
  
  // Default values
  protected attributes = {
    is_active: true,
    role: 'user'
  };
}
```

### UUID Primary Keys

```typescript
export default class User extends Model {
  protected static table = 'users';
  protected static keyType = 'string' as const;
  protected static incrementing = false;

  // Attributes
  id!: string; // UUID primary key
  name!: string;
  email!: string;
}

// Usage
const user = await User.create({
  name: 'John Doe',
  email: 'john@example.com'
});
// user.id will be a generated UUID
```

### Attribute Casting

```typescript
class User extends Model {
  protected casts = {
    // Date casting
    email_verified_at: 'date' as const,
    birth_date: 'date' as const,
    
    // Boolean casting
    is_admin: 'boolean' as const,
    is_active: 'boolean' as const,
    
    // Number casting
    age: 'number' as const,
    salary: 'float' as const,
    
    // JSON casting
    preferences: 'json' as const,
    metadata: 'object' as const,
    tags: 'array' as const
  };
}
```

### Custom Casts

```typescript
// Built-in custom casts
import { MoneyCast, EncryptedCast, JsonCast, ArrayCast, DateCast } from 'ilana-orm';

class Product extends Model {
  protected casts = {
    price: new MoneyCast(),
    secret_data: new EncryptedCast('your-encryption-key'),
    metadata: new JsonCast(),
    tags: new ArrayCast(),
    published_at: new DateCast()
  };
}

// Define custom cast
class MoneyCast {
  get(value: any) {
    return value ? parseFloat(value) / 100 : null;
  }
  
  set(value: any) {
    return value ? Math.round(value * 100) : null;
  }
}

// Generate custom cast with CLI
// ilana make:cast MoneyCast
// Creates: casts/MoneyCast.ts
```

### Mutators and Accessors

```typescript
class User extends Model {
  // Mutator - transform data when setting
  setPasswordAttribute(value: string) {
    this.attributes.password = bcrypt.hashSync(value, 10);
  }
  
  setEmailAttribute(value: string) {
    this.attributes.email = value.toLowerCase().trim();
  }
  
  // Accessor - transform data when getting
  getFullNameAttribute(): string {
    return `${this.first_name} ${this.last_name}`;
  }
  
  getAvatarUrlAttribute(): string {
    return this.avatar 
      ? `/uploads/avatars/${this.avatar}`
      : '/images/default-avatar.png';
  }
}
```

### Model Events

```typescript
class User extends Model {
  protected static events = {
    // Before saving (create or update)
    saving: async (user) => {
      user.email = user.email.toLowerCase();
    },
    
    // After saving
    saved: async (user) => {
      await clearUserCache(user.id);
    },
    
    // Before creating
    creating: async (user) => {
      user.uuid = generateUuid();
    },
    
    // After creating
    created: async (user) => {
      await sendWelcomeEmail(user.email);
    },
    
    // Before updating
    updating: async (user) => {
      if (user.isDirty('email')) {
        user.email_verified_at = null;
      }
    },
    
    // After updating
    updated: async (user) => {
      await syncUserData(user);
    },
    
    // Before deleting
    deleting: async (user) => {
      await user.posts().delete();
    },
    
    // After deleting
    deleted: async (user) => {
      await cleanupUserFiles(user.id);
    }
  };
}
```

### Model Observers

Observers provide a clean way to organize model event handling logic into separate classes, promoting better code organization and reusability.

#### Creating Observers

```bash
# Generate observer
ilana make:observer UserObserver

# Generate observer for specific model
ilana make:observer UserObserver --model=User
```

#### Observer Structure

```typescript
// observers/UserObserver.ts
import User from '../models/User';

export default class UserObserver {
  async creating(user: User): Promise<void> {
    // Logic before creating user
    user.email = user.email.toLowerCase();
    user.uuid = generateUuid();
  }

  async created(user: User): Promise<void> {
    // Logic after creating user
    await sendWelcomeEmail(user.email);
    await createUserProfile(user.id);
  }

  async updating(user: User): Promise<void> {
    // Logic before updating user
    if (user.isDirty('email')) {
      user.email_verified_at = null;
    }
  }

  async updated(user: User): Promise<void> {
    // Logic after updating user
    await syncUserData(user);
    await clearUserCache(user.id);
  }

  async saving(user: User): Promise<void> {
    // Logic before saving (create or update)
    user.updated_at = new Date();
  }

  async saved(user: User): Promise<void> {
    // Logic after saving (create or update)
    await logUserActivity(user);
  }

  async deleting(user: User): Promise<void> {
    // Logic before deleting user
    await user.posts().delete();
    await user.comments().delete();
  }

  async deleted(user: User): Promise<void> {
    // Logic after deleting user
    await cleanupUserFiles(user.id);
    await removeFromExternalServices(user);
  }

  async restoring(user: User): Promise<void> {
    // Logic before restoring soft-deleted user
    await validateUserRestore(user);
  }

  async restored(user: User): Promise<void> {
    // Logic after restoring soft-deleted user
    await sendAccountRestoredEmail(user);
  }
}
```

#### Registering Observers

```typescript
// Register observer class
User.observe(UserObserver);

// Register multiple observers
User.observe(UserObserver);
User.observe(AuditObserver);
User.observe(EmailNotificationObserver);

// Register observer with events object
User.observe({
  creating: async (user) => {
    user.email = user.email.toLowerCase();
  },
  created: async (user) => {
    await sendWelcomeEmail(user.email);
  }
});
```

#### Observer Registration Patterns

```typescript
// 1. Application Bootstrap
// app.ts or index.ts
import User from './models/User';
import UserObserver from './observers/UserObserver';

// Register observers during app initialization
User.observe(UserObserver);

// 2. Service Provider Pattern
// providers/ObserverServiceProvider.ts
export class ObserverServiceProvider {
  static register(): void {
    User.observe(UserObserver);
    Post.observe(PostObserver);
    Order.observe(OrderObserver);
  }
}

// app.ts
ObserverServiceProvider.register();

// 3. Dedicated Observer Registration
// observers/index.ts
import User from '../models/User';
import Post from '../models/Post';
import UserObserver from './UserObserver';
import PostObserver from './PostObserver';
import AuditObserver from './AuditObserver';

// Register all observers
User.observe(UserObserver);
User.observe(AuditObserver);
Post.observe(PostObserver);
Post.observe(AuditObserver);

// app.ts
import './observers'; // Auto-registers all observers
```

#### Reusable Observers

```typescript
// observers/AuditObserver.ts
export default class AuditObserver {
  async created(model: any): Promise<void> {
    await AuditLog.create({
      model_type: model.constructor.name,
      model_id: model.id,
      action: 'created',
      data: model.toJSON()
    });
  }

  async updated(model: any): Promise<void> {
    await AuditLog.create({
      model_type: model.constructor.name,
      model_id: model.id,
      action: 'updated',
      changes: model.getDirty()
    });
  }

  async deleted(model: any): Promise<void> {
    await AuditLog.create({
      model_type: model.constructor.name,
      model_id: model.id,
      action: 'deleted'
    });
  }
}

// Use across multiple models
User.observe(AuditObserver);
Post.observe(AuditObserver);
Product.observe(AuditObserver);
```

#### Conditional Observer Registration

```typescript
// Environment-specific observers
if (process.env.NODE_ENV === 'production') {
  User.observe(ProductionUserObserver);
} else {
  User.observe(DevelopmentUserObserver);
}

// Feature-based observers
if (config.features.emailNotifications) {
  User.observe(EmailNotificationObserver);
}

if (config.features.analytics) {
  User.observe(AnalyticsObserver);
}

// A/B testing observers
if (user.isInExperimentGroup('new_onboarding')) {
  User.observe(NewOnboardingObserver);
} else {
  User.observe(StandardOnboardingObserver);
}
```

#### Observer vs Model Events

**Use Model Events for:**
- Core business logic that's integral to the model
- Simple, single-purpose operations
- Logic that should always run

**Use Observers for:**
- Side effects and cross-cutting concerns
- Complex logic that can be organized into classes
- Logic that might be conditionally applied
- Reusable functionality across multiple models
- Better testing and mocking capabilities

### Query Scopes

```typescript
class Post extends Model {
  // Simple scope
  static scopePublished(query) {
    return query.where('is_published', true);
  }
  
  // Scope with parameters
  static scopeOfType(query, type: string) {
    return query.where('type', type);
  }
  
  // Complex scope
  static scopePopular(query, threshold = 100) {
    return query.where('views', '>', threshold)
                .orderBy('views', 'desc');
  }
}

// Usage
const posts = await Post.query()
  .published()
  .ofType('article')
  .popular(500)
  .get();
```

## Query Builder

### Basic Queries

```typescript
// Select all
const users = await User.all();

// Find by primary key
const user = await User.find(1);
const user = await User.findOrFail(1); // Throws if not found

// First record
const user = await User.first();
const user = await User.firstOrFail(); // Throws if not found

// Create or find
const user = await User.firstOrCreate(
  { email: 'john@example.com' },
  { name: 'John Doe' }
);

// Update or create
const user = await User.updateOrCreate(
  { email: 'john@example.com' },
  { name: 'John Smith', is_active: true }
);
```

### Where Clauses

```typescript
// Basic where
const users = await User.query()
  .where('is_active', true)
  .where('age', '>', 18)
  .get();

// Where with operator
const users = await User.query()
  .where('age', '>=', 21)
  .where('name', 'like', '%john%')
  .get();

// Or where
const users = await User.query()
  .where('role', 'admin')
  .orWhere('role', 'moderator')
  .get();

// Where in
const users = await User.query()
  .whereIn('role', ['admin', 'editor', 'author'])
  .get();

// Where null/not null
const users = await User.query()
  .whereNull('deleted_at')
  .whereNotNull('email_verified_at')
  .get();

// Where between
const users = await User.query()
  .whereBetween('age', [18, 65])
  .get();

// JSON queries (database-specific)
const users = await User.query()
  .whereJsonContains('preferences', { theme: 'dark' })
  .whereJsonLength('tags', '>', 3)
  .get();

// Date queries
const users = await User.query()
  .whereDate('created_at', '2023-12-01')
  .whereMonth('created_at', 12)
  .whereYear('created_at', 2023)
  .get();

// Exists queries
const users = await User.query()
  .whereExists(query => {
    query.select('*').from('posts').whereRaw('posts.user_id = users.id');
  })
  .get();

// Conditional queries
const users = await User.query()
  .when(filters.role, (query, role) => {
    query.where('role', role);
  })
  .when(filters.search, (query, search) => {
    query.where('name', 'like', `%${search}%`);
  })
  .get();
```

### Joins and Aggregates

```typescript
// Inner join
const posts = await Post.query()
  .join('users', 'posts.user_id', 'users.id')
  .select('posts.*', 'users.name as author_name')
  .get();

// Aggregates
const count = await User.query().count();
const avgAge = await User.query().avg('age');
const totalSalary = await User.query().sum('salary');

// Group by with having
const roleStats = await User.query()
  .select('role')
  .selectRaw('COUNT(*) as count')
  .groupBy('role')
  .having('count', '>', 10)
  .get();
```

### Ordering and Limiting

```typescript
const users = await User.query()
  .orderBy('name')
  .orderBy('created_at', 'desc')
  .limit(10)
  .offset(20)
  .get();
```

### Raw Queries

```typescript
// Raw where
const users = await User.query()
  .whereRaw('age > ? AND salary < ?', [25, 50000])
  .get();

// Raw select
const users = await User.query()
  .selectRaw('*, YEAR(created_at) as year')
  .get();
```

## Relationships

### One-to-One

```typescript
class User extends Model {
  // User has one profile
  profile() {
    return this.hasOne(Profile, 'user_id');
  }
}

class Profile extends Model {
  // Profile belongs to user
  user() {
    return this.belongsTo(User, 'user_id');
  }
}

// Usage
const user = await User.with('profile').first();
const profile = user.profile;
```

### One-to-Many

```typescript
class User extends Model {
  // User has many posts
  posts() {
    return this.hasMany(Post, 'user_id');
  }
}

class Post extends Model {
  // Post belongs to user
  author() {
    return this.belongsTo(User, 'user_id');
  }
}

// Usage
const user = await User.with('posts').first();
const posts = user.posts;
```

### Many-to-Many

```typescript
class User extends Model {
  // User belongs to many roles
  roles() {
    return this.belongsToMany(Role, 'user_roles', 'user_id', 'role_id')
      .withPivot('assigned_at', 'assigned_by')
      .withTimestamps();
  }
}

class Role extends Model {
  // Role belongs to many users
  users() {
    return this.belongsToMany(User, 'user_roles', 'role_id', 'user_id');
  }
}

// Usage
const user = await User.with('roles').first();
const roles = user.roles;

// Access pivot data
roles.forEach(role => {
  console.log(role.pivot.assigned_at);
});
```

### Polymorphic Relationships

```typescript
class Comment extends Model {
  // Comment can belong to Post or Video
  commentable() {
    return this.morphTo('commentable');
  }
}

class Post extends Model {
  // Post has many comments (polymorphic)
  comments() {
    return this.morphMany(Comment, 'commentable');
  }
}

class Video extends Model {
  // Video has many comments (polymorphic)
  comments() {
    return this.morphMany(Comment, 'commentable');
  }
}
```

### Has-Many-Through

```typescript
class Country extends Model {
  // Country has many posts through users
  posts() {
    return this.hasManyThrough(Post, User, 'country_id', 'user_id');
  }
}
```

### Eager Loading

```typescript
// Basic eager loading
const users = await User.with('posts').get();

// Multiple relationships
const users = await User.with('posts', 'roles', 'profile').get();

// Nested relationships
const users = await User.with('posts.comments').get();

// Constrained eager loading
const users = await User.query()
  .withConstraints('posts', (query) => {
    query.where('is_published', true)
         .orderBy('created_at', 'desc')
         .limit(5);
  })
  .get();

// Lazy loading
const user = await User.first();
await user.load('posts');

// Count relationships
const users = await User.withCount('posts').get();
// Each user will have posts_count attribute
```

## Migrations

### Creating Migrations

```bash
# Create a new migration
ilana make:migration create_users_table

# Create migration for existing table
ilana make:migration add_avatar_to_users_table --table=users
```

### Migration Structure

```typescript
import { SchemaBuilder } from 'ilana-orm';

export default class CreateUsersTable {
  async up(schema: SchemaBuilder): Promise<void> {
    await schema.createTable('users', (table) => {
      // Primary key
      table.increments('id');
      // For UUID: table.uuid('id').primary();
      
      // Basic columns
      table.string('name').notNullable();
      table.string('email').unique().notNullable();
      table.string('password').notNullable();
      
      // Nullable columns
      table.string('avatar').nullable();
      table.timestamp('email_verified_at').nullable();
      
      // Timestamps
      table.timestamps(true, true);
      
      // Soft deletes
      table.timestamp('deleted_at').nullable();
      
      // Indexes
      table.index('email');
      table.index(['name', 'email']);
    });
  }

  async down(schema: SchemaBuilder): Promise<void> {
    await schema.dropTable('users');
  }
}
```

### Column Types

```typescript
export default class CreateProductsTable {
  async up(schema: SchemaBuilder): Promise<void> {
    await schema.createTable('products', (table) => {
      // Primary key types
      table.increments('id'); // Auto-incrementing integer
      table.bigIncrements('big_id'); // Auto-incrementing big integer
      // table.uuid('id').primary(); // UUID primary key
      
      // Numeric types
      table.integer('quantity');
      table.bigInteger('views');
      table.smallInteger('priority');
      table.tinyInteger('status_code');
      table.decimal('price', 8, 2); // precision, scale
      table.float('rating', 3, 1); // precision, scale
      table.double('coordinates');
      table.real('measurement');
      
      // String types
      table.string('name', 255); // VARCHAR with length
      table.text('description'); // TEXT
      table.longText('content'); // LONGTEXT (MySQL)
      table.mediumText('summary'); // MEDIUMTEXT (MySQL)
      table.char('code', 10); // CHAR with fixed length
      table.varchar('slug', 100); // VARCHAR (alias for string)
      
      // Date/Time types
      table.date('release_date'); // DATE
      table.time('available_time'); // TIME
      table.datetime('published_at'); // DATETIME
      table.timestamp('created_at'); // TIMESTAMP
      table.timestamps(); // created_at & updated_at
      table.timestamps(true, true); // with timezone
      
      // Boolean
      table.boolean('is_active').defaultTo(true);
      
      // JSON types
      table.json('metadata'); // JSON (all databases)
      table.jsonb('settings'); // JSONB (PostgreSQL only)
      
      // Binary types
      table.binary('file_data'); // BLOB/BYTEA
      table.varbinary('hash', 32); // VARBINARY
      
      // UUID
      table.uuid('uuid');
      
      // Enum (MySQL/PostgreSQL)
      table.enum('status', ['draft', 'published', 'archived']);
      
      // Set (MySQL only)
      table.set('permissions', ['read', 'write', 'delete']);
      
      // Geometry types (PostgreSQL/MySQL)
      table.geometry('location');
      table.point('coordinates');
      table.lineString('path');
      table.polygon('area');
      
      // Array types (PostgreSQL only)
      table.specificType('tags', 'text[]');
      table.specificType('scores', 'integer[]');
      
      // Network types (PostgreSQL only)
      table.inet('ip_address');
      table.macaddr('mac_address');
      
      // Range types (PostgreSQL only)
      table.specificType('price_range', 'numrange');
      table.specificType('date_range', 'daterange');
      
      // Full-text search (PostgreSQL)
      table.specificType('search_vector', 'tsvector');
      
      // Custom types
      table.specificType('custom_type', 'your_custom_type');
      
      // Foreign keys
      table.integer('user_id').unsigned();
      table.foreign('user_id').references('id').inTable('users');
      
      // Shorthand foreign key
      table.foreignId('category_id').constrained();
      table.foreignUuid('parent_id').constrained('products');
    });
  }
}
```

### Column Modifiers and Constraints

```typescript
export default class CreateUsersTable {
  async up(schema: SchemaBuilder): Promise<void> {
    await schema.createTable('users', (table) => {
      table.increments('id');
      
      // Nullable/Not nullable
      table.string('name').notNullable();
      table.string('nickname').nullable();
      
      // Default values
      table.boolean('is_active').defaultTo(true);
      table.timestamp('created_at').defaultTo(schema.fn.now());
      table.string('role').defaultTo('user');
      table.integer('login_count').defaultTo(0);
      
      // Unique constraints
      table.string('email').unique();
      table.string('username').unique('unique_username');
      
      // Indexes
      table.string('slug').index();
      table.string('search_vector').index('search_idx');
      
      // Composite indexes
      table.index(['name', 'email'], 'name_email_idx');
      table.unique(['email', 'tenant_id'], 'unique_email_per_tenant');
      
      // Comments
      table.string('api_key').comment('User API key for external services');
      
      // Unsigned (for integers)
      table.integer('age').unsigned();
      
      // Auto increment
      table.integer('order_number').autoIncrement();
      
      // Column positioning (MySQL only)
      table.string('middle_name').after('first_name');
      table.string('prefix').first();
      
      // Check constraints (PostgreSQL/SQLite)
      table.integer('age').checkPositive();
      table.string('email').checkRegex('^[^@]+@[^@]+\.[^@]+$');
      
      // Generated columns (MySQL 5.7+/PostgreSQL)
      table.string('full_name').generatedAs('CONCAT(first_name, " ", last_name)');
      
      // Collation (MySQL/PostgreSQL)
      table.string('name').collate('utf8_unicode_ci');
    });
  }
}
```

### Modifying Tables

```typescript
// Add columns
export default class AddAvatarToUsersTable {
  async up(schema: SchemaBuilder): Promise<void> {
    await schema.table('users', (table) => {
      table.string('avatar').nullable().after('email');
      table.text('bio').nullable();
      table.timestamp('last_login_at').nullable();
      
      // Add index
      table.index('last_login_at');
      
      // Add foreign key
      table.integer('department_id').unsigned().nullable();
      table.foreign('department_id').references('id').inTable('departments');
    });
  }

  async down(schema: SchemaBuilder): Promise<void> {
    await schema.table('users', (table) => {
      // Drop foreign key first
      table.dropForeign(['department_id']);
      
      // Drop columns
      table.dropColumn(['avatar', 'bio', 'last_login_at', 'department_id']);
      
      // Drop index
      table.dropIndex(['last_login_at']);
    });
  }
}

// Modify existing columns
export default class ModifyUsersTable {
  async up(schema: SchemaBuilder): Promise<void> {
    await schema.table('users', (table) => {
      // Change column type
      table.text('bio').alter();
      
      // Rename column
      table.renameColumn('name', 'full_name');
      
      // Change column to nullable
      table.string('phone').nullable().alter();
      
      // Change default value
      table.boolean('is_active').defaultTo(false).alter();
      
      // Add/drop constraints
      table.string('email').unique().alter();
      table.dropUnique(['username']);
      
      // Modify index
      table.dropIndex(['old_column']);
      table.index(['new_column']);
    });
  }

  async down(schema: SchemaBuilder): Promise<void> {
    await schema.table('users', (table) => {
      table.string('bio').alter();
      table.renameColumn('full_name', 'name');
      table.string('phone').notNullable().alter();
      table.boolean('is_active').defaultTo(true).alter();
    });
  }
}
```

### Indexes and Foreign Keys

```typescript
export default class CreatePostsTable {
  async up(schema: SchemaBuilder): Promise<void> {
    await schema.createTable('posts', (table) => {
      table.increments('id');
      table.string('title');
      table.text('content');
      table.integer('user_id').unsigned();
      table.integer('category_id').unsigned();
      table.timestamps();
      
      // Simple indexes
      table.index('title');
      table.index('created_at');
      
      // Composite indexes
      table.index(['user_id', 'created_at'], 'user_posts_idx');
      table.index(['category_id', 'is_published'], 'category_published_idx');
      
      // Unique indexes
      table.unique(['user_id', 'slug'], 'unique_user_slug');
      
      // Partial indexes (PostgreSQL)
      table.index(['title'], 'published_posts_title_idx', {
        where: 'is_published = true'
      });
      
      // Full-text indexes (MySQL)
      table.index(['title', 'content'], 'fulltext_idx', 'FULLTEXT');
      
      // Spatial indexes (MySQL/PostgreSQL)
      table.index(['location'], 'location_idx', 'SPATIAL');
      
      // Foreign keys with actions
      table.foreign('user_id')
           .references('id')
           .inTable('users')
           .onDelete('CASCADE')
           .onUpdate('CASCADE');
           
      table.foreign('category_id')
           .references('id')
           .inTable('categories')
           .onDelete('SET NULL')
           .onUpdate('RESTRICT');
      
      // Named foreign keys
      table.foreign('user_id', 'fk_posts_user_id')
           .references('id')
           .inTable('users');
      
      // Shorthand foreign keys
      table.foreignId('author_id').constrained('users');
      table.foreignUuid('parent_id').constrained('posts');
    });
  }

  async down(schema: SchemaBuilder): Promise<void> {
    await schema.dropTable('posts');
  }
}
```

### Database-Specific Features

```typescript
// PostgreSQL specific features
export default class PostgreSQLFeatures {
  async up(schema: SchemaBuilder): Promise<void> {
    // Create schema
    await schema.createSchema('analytics');
    
    // Create table in specific schema
    await schema.createTable('analytics.events', (table) => {
      table.uuid('id').primary();
      table.jsonb('data');
      table.specificType('tags', 'text[]');
      table.timestamp('created_at').defaultTo(schema.fn.now());
      
      // GIN index for JSONB
      table.index(['data'], 'events_data_gin', 'GIN');
      
      // Partial index
      table.index(['created_at'], 'recent_events_idx', {
        where: 'created_at > NOW() - INTERVAL \'30 days\''
      });
    });
    
    // Create extension
    await schema.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    
    // Create custom type
    await schema.raw(`
      CREATE TYPE mood AS ENUM ('sad', 'ok', 'happy')
    `);
  }
}

// MySQL specific features
export default class MySQLFeatures {
  async up(schema: SchemaBuilder): Promise<void> {
    await schema.createTable('products', (table) => {
      table.increments('id');
      table.string('name');
      table.text('description');
      
      // Full-text index
      table.index(['name', 'description'], 'fulltext_idx', 'FULLTEXT');
      
      // JSON column with generated column
      table.json('attributes');
      table.string('brand').generatedAs('JSON_UNQUOTE(JSON_EXTRACT(attributes, "$.brand"))');
      
      // Spatial data
      table.point('location');
      table.index(['location'], 'location_idx', 'SPATIAL');
    });
    
    // Set table engine and charset
    await schema.raw(`
      ALTER TABLE products 
      ENGINE=InnoDB 
      DEFAULT CHARSET=utf8mb4 
      COLLATE=utf8mb4_unicode_ci
    `);
  }
}
```

### Migration Utilities

```typescript
export default class UtilityMigration {
  async up(schema: SchemaBuilder): Promise<void> {
    // Check if table exists
    if (await schema.hasTable('users')) {
      console.log('Users table already exists');
      return;
    }
    
    // Check if column exists
    if (await schema.hasColumn('users', 'email')) {
      console.log('Email column already exists');
      return;
    }
    
    // Raw SQL execution
    await schema.raw('SET foreign_key_checks = 0');
    
    // Create table with raw SQL
    await schema.raw(`
      CREATE TABLE IF NOT EXISTS custom_table (
        id INT AUTO_INCREMENT PRIMARY KEY,
        data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Conditional operations based on database
    if (schema.client.config.client === 'mysql2') {
      await schema.raw('ALTER TABLE users ADD FULLTEXT(name, bio)');
    } else if (schema.client.config.client === 'pg') {
      await schema.raw('CREATE INDEX CONCURRENTLY idx_users_name ON users(name)');
    }
  }
}
```

### Running Migrations

```bash
# Run all pending migrations
ilana migrate
ilana migrate --connection=mysql
ilana migrate --connection=postgres_analytics

# Run specific migration file
ilana migrate --only=20231201_create_users_table.ts

# Run migrations up to specific batch
ilana migrate --to=20231201_120000

# Rollback migrations
ilana migrate:rollback
ilana migrate:rollback --step=2
ilana migrate:rollback --to=20231201_120000
ilana migrate:rollback --connection=postgres_analytics

# Reset all migrations
ilana migrate:reset
ilana migrate:reset --connection=mysql

# Fresh migration (drop all + migrate)
ilana migrate:fresh
ilana migrate:fresh --connection=postgres_analytics

# Fresh with seeding
ilana migrate:fresh --seed
ilana migrate:fresh --seed --connection=mysql

# Check migration status
ilana migrate:status
ilana migrate:status --connection=postgres_analytics

# List completed migrations
ilana migrate:list

# Unlock migrations (if stuck)
ilana migrate:unlock
```

## Seeders

### Creating Seeders

```bash
# Create a seeder
ilana make:seeder UserSeeder
```

### Seeder Structure

```typescript
import { Seeder } from 'ilana-orm';
import User from '../models/User';

export default class UserSeeder extends Seeder {
  async run(): Promise<void> {
    // Create admin user
    await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'password',
      role: 'admin'
    });
    
    // Create test users using factory
    await User.factory().times(50).create();
    
    // Create users with specific states
    await User.factory().times(5).state('admin').create();
  }
}
```

### Advanced Seeding Techniques

```typescript
export default class DatabaseSeeder extends Seeder {
  async run(): Promise<void> {
    // Disable foreign key checks
    await this.disableForeignKeyChecks();
    
    // Truncate tables in correct order
    await this.truncateInOrder([
      'user_roles',
      'posts', 
      'users',
      'roles',
      'categories'
    ]);
    
    // Seed in dependency order
    await this.call([
      RoleSeeder,
      CategorySeeder,
      UserSeeder,
      PostSeeder,
      UserRoleSeeder
    ]);
    
    // Re-enable foreign key checks
    await this.enableForeignKeyChecks();
  }
  
  private async truncateInOrder(tables: string[]): Promise<void> {
    for (const table of tables) {
      await this.db.raw(`TRUNCATE TABLE ${table}`);
    }
  }
  
  private async call(seeders: any[]): Promise<void> {
    for (const SeederClass of seeders) {
      const seeder = new SeederClass();
      await seeder.run();
      console.log(`Seeded: ${SeederClass.name}`);
    }
  }
  
  private async disableForeignKeyChecks(): Promise<void> {
    const client = this.db.client.config.client;
    
    if (client === 'mysql2') {
      await this.db.raw('SET FOREIGN_KEY_CHECKS = 0');
    } else if (client === 'pg') {
      await this.db.raw('SET session_replication_role = replica');
    }
  }
  
  private async enableForeignKeyChecks(): Promise<void> {
    const client = this.db.client.config.client;
    
    if (client === 'mysql2') {
      await this.db.raw('SET FOREIGN_KEY_CHECKS = 1');
    } else if (client === 'pg') {
      await this.db.raw('SET session_replication_role = DEFAULT');
    }
  }
}
```

### Connection-Specific Seeding

```typescript
export default class AnalyticsSeeder extends Seeder {
  // Specify connection for this seeder
  protected connection = 'analytics_db';
  
  async run(): Promise<void> {
    // This will run on analytics_db connection
    await AnalyticsEvent.create({
      event_type: 'user_signup',
      data: { source: 'web' },
      created_at: new Date()
    });
  }
}
```

### Conditional and Environment-Specific Seeding

```typescript
export default class UserSeeder extends Seeder {
  async run(): Promise<void> {
    // Only seed if no users exist
    const userCount = await User.count();
    
    if (userCount === 0) {
      await this.seedUsers();
    }
    
    // Environment-specific seeding
    if (process.env.NODE_ENV === 'development') {
      await this.seedTestData();
    }
    
    if (process.env.NODE_ENV === 'production') {
      await this.seedProductionData();
    }
    
    // Feature flag based seeding
    if (process.env.ENABLE_PREMIUM_FEATURES === 'true') {
      await this.seedPremiumFeatures();
    }
  }
  
  private async seedUsers(): Promise<void> {
    // Create admin user
    await User.create({
      name: 'System Admin',
      email: 'admin@example.com',
      password: 'secure_password',
      role: 'admin'
    });
    
    // Create regular users
    await User.factory().times(10).create();
  }
  
  private async seedTestData(): Promise<void> {
    // Test users with known credentials
    await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password'
    });
    
    // Create users with all possible states
    await User.factory().state('admin').create();
    await User.factory().state('inactive').create();
    await User.factory().state('premium').create();
  }
  
  private async seedProductionData(): Promise<void> {
    // Only essential data for production
    await User.create({
      name: 'System Administrator',
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role: 'admin'
    });
  }
  
  private async seedPremiumFeatures(): Promise<void> {
    await Feature.create({
      name: 'Premium Analytics',
      is_premium: true,
      is_enabled: true
    });
  }
}
```

### Seeder with Progress Tracking

```typescript
export default class LargeDataSeeder extends Seeder {
  async run(): Promise<void> {
    const totalUsers = 10000;
    
    // Built-in progress tracking
    await this.progress(totalUsers, async (updateProgress) => {
      const users = await this.createInBatches(
        User.factory(), 
        totalUsers, 
        { is_active: true }
      );
      updateProgress(users.length);
    });
    
    console.log('User seeding completed!');
  }
}

// Advanced seeder utilities
export default class DatabaseSeeder extends Seeder {
  async run(): Promise<void> {
    // Run seeders with connection mapping
    await this.callWith({
      'UserSeeder': UserSeeder,
      'PostSeeder': PostSeeder
    }, 'mysql_primary');
    
    // Run seeder only once (idempotent)
    await this.callOnce(AdminSeeder, 'admin_user_setup');
    
    // Wipe entire database
    await this.wipeDatabase();
  }
}
```

### Running Seeders

```bash
# Run all seeders
ilana seed

# Run specific seeder
ilana seed --class=UserSeeder

# Run seeders for specific connection
ilana seed --connection=mysql
ilana seed --connection=analytics_db

# Run seeders with environment
NODE_ENV=development ilana seed
NODE_ENV=production ilana seed --class=ProductionSeeder

# Fresh migration with seeding
ilana migrate:fresh --seed
ilana migrate:fresh --seed --connection=analytics_db

# Seed specific connection after migration
ilana migrate --connection=analytics_db
ilana seed --connection=analytics_db
```

## Model Factories

### Defining Factories

```typescript
import { defineFactory } from 'ilana-orm';
import { faker } from '@faker-js/faker';
import User from '../models/User';

export default defineFactory(User, () => ({
  name: faker.person.fullName(),
  email: faker.internet.email(),
  password: 'password123',
  age: faker.number.int({ min: 18, max: 80 }),
  is_active: true
}));
```

### Factory States

```typescript
export default defineFactory(User, () => ({
  name: faker.person.fullName(),
  email: faker.internet.email(),
  password: 'password123',
  role: 'user'
}))
.state('admin', () => ({
  role: 'admin',
  is_admin: true
}))
.state('inactive', () => ({
  is_active: false
}));
```

### Using Factories

```typescript
// Create single model
const user = await User.factory().create();

// Create multiple models
const users = await User.factory().times(10).create();

// Create with specific attributes
const user = await User.factory().create({
  name: 'John Doe',
  email: 'john@example.com'
});

// Create with state
const admin = await User.factory().state('admin').create();

// Create with multiple states
const premiumAdmin = await User.factory()
  .state('admin')
  .state('premium')
  .create();

// Make without saving
const user = User.factory().make();
const users = User.factory().times(5).make();

// Create raw attributes (plain objects)
const userData = User.factory().raw();
const usersData = User.factory().times(3).raw();

// Advanced factory methods
const user = await User.factory()
  .configure(factory => {
    factory.resetSequence('email');
  })
  .when(someCondition, factory => {
    factory.state('premium');
  })
  .unless(otherCondition, factory => {
    factory.state('basic');
  })
  .create();

// Create with relationships
const user = await User.factory()
  .createWithRelations({}, {
    roles: [{ id: 1, name: 'admin' }]
  });

// Batch creation for performance
const users = await User.factory()
  .times(10000)
  .createInBatches(500);
```

### Factory Relationships

```typescript
// Post factory with automatic user creation
export const PostFactory = defineFactory(Post, () => ({
  title: faker.lorem.sentence(),
  content: faker.lorem.paragraphs(3),
  is_published: faker.datatype.boolean(),
  published_at: faker.date.past()
}))
.afterCreating(async (post) => {
  // Create user if not provided
  if (!post.user_id) {
    const user = await User.factory().create();
    post.user_id = user.id;
    await post.save();
  }
});

// Factory with relationship method
export const PostFactory = defineFactory(Post, () => ({
  title: faker.lorem.sentence(),
  content: faker.lorem.paragraphs(3)
}))
.for('user', () => User.factory()) // Define relationship
.for('category', () => Category.factory());

// Usage
const post = await Post.factory()
  .for('user', User.factory().state('admin'))
  .create();

// Create with existing relationships
const user = await User.factory().create();
const posts = await Post.factory()
  .times(5)
  .create({ user_id: user.id });

// Create nested relationships
const userWithPosts = await User.factory()
  .has(Post.factory().times(3), 'posts')
  .create();

// Many-to-many relationships
const userWithRoles = await User.factory()
  .hasAttached(Role.factory().times(2), 'roles')
  .create();
```

### Factory Sequences

```typescript
export default defineFactory(User, () => {
  let sequence = 0;
  
  return {
    name: faker.person.fullName(),
    email: () => `user${++sequence}@example.com`,
    username: () => `user${sequence}`,
    order: () => sequence
  };
});

// Global sequence
let globalUserSequence = 0;

export default defineFactory(User, () => ({
  name: faker.person.fullName(),
  email: `user${++globalUserSequence}@example.com`,
  sequence_number: globalUserSequence
}));
```

### Factory Callbacks and Hooks

```typescript
export default defineFactory(User, () => ({
  name: faker.person.fullName(),
  email: faker.internet.email(),
  password: 'password123'
}))
.afterMaking((user) => {
  // Called after making (before saving)
  user.slug = user.name.toLowerCase().replace(/\s+/g, '-');
  user.display_name = user.name.toUpperCase();
})
.afterCreating(async (user) => {
  // Called after creating (after saving)
  await user.profile().create({
    bio: faker.lorem.paragraph(),
    avatar: faker.image.avatar()
  });
  
  // Send welcome email
  await sendWelcomeEmail(user.email);
})
.beforeMaking((attributes) => {
  // Modify attributes before making
  if (!attributes.email) {
    attributes.email = `${attributes.name.replace(/\s+/g, '.')}@example.com`;
  }
  return attributes;
})
.beforeCreating(async (user) => {
  // Called before saving to database
  user.email_verified_at = new Date();
});
```

### Factory Traits and Complex States

```typescript
export default defineFactory(User, () => ({
  name: faker.person.fullName(),
  email: faker.internet.email(),
  password: 'password123',
  role: 'user',
  is_active: true,
  subscription_type: 'free'
}))
.state('admin', () => ({
  role: 'admin',
  is_admin: true,
  permissions: ['read', 'write', 'delete', 'admin']
}))
.state('inactive', () => ({
  is_active: false,
  deactivated_at: faker.date.past(),
  deactivation_reason: 'user_request'
}))
.state('premium', () => ({
  subscription_type: 'premium',
  subscription_expires_at: faker.date.future(),
  premium_features: ['analytics', 'priority_support']
}))
.state('verified', () => ({
  email_verified_at: faker.date.past(),
  phone_verified_at: faker.date.past()
}))
.state('with_profile', () => ({}))
.afterCreating(async (user, evaluator) => {
  if (evaluator.hasState('with_profile')) {
    await user.profile().create({
      bio: faker.lorem.paragraph(),
      website: faker.internet.url(),
      location: faker.location.city()
    });
  }
});

// Usage with multiple states
const user = await User.factory()
  .state('admin')
  .state('premium')
  .state('verified')
  .state('with_profile')
  .create();
```

### Factory with Custom Logic

```typescript
export default defineFactory(Product, () => {
  const categories = ['electronics', 'clothing', 'books', 'home', 'sports'];
  const category = faker.helpers.arrayElement(categories);
  
  // Category-specific logic
  const getCategorySpecificData = (cat: string) => {
    switch (cat) {
      case 'electronics':
        return {
          warranty_months: faker.number.int({ min: 6, max: 36 }),
          brand: faker.helpers.arrayElement(['Apple', 'Samsung', 'Sony'])
        };
      case 'clothing':
        return {
          size: faker.helpers.arrayElement(['XS', 'S', 'M', 'L', 'XL']),
          color: faker.color.human()
        };
      case 'books':
        return {
          isbn: faker.string.numeric(13),
          pages: faker.number.int({ min: 100, max: 800 })
        };
      default:
        return {};
    }
  };
  
  return {
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    price: faker.commerce.price({ min: 10, max: 1000 }),
    category,
    sku: `${category.toUpperCase()}-${faker.string.alphanumeric(8)}`,
    in_stock: faker.datatype.boolean(),
    stock_quantity: faker.number.int({ min: 0, max: 100 }),
    ...getCategorySpecificData(category)
  };
});
```

### Factory Performance Optimization

```typescript
// Batch creation for better performance
const users = await User.factory().times(1000).create();

// Create in chunks to avoid memory issues
const createUsersInChunks = async (total: number, chunkSize: number = 100) => {
  const chunks = Math.ceil(total / chunkSize);
  
  for (let i = 0; i < chunks; i++) {
    const currentBatchSize = Math.min(chunkSize, total - (i * chunkSize));
    await User.factory().times(currentBatchSize).create();
    console.log(`Created chunk ${i + 1}/${chunks}`);
  }
};

await createUsersInChunks(10000, 500);

// High-performance bulk factory
import { BulkFactory, bulkFactory } from 'ilana-orm';

const bulk = bulkFactory(User, (faker) => ({
  name: faker.person.fullName(),
  email: faker.internet.email()
}));

const users = await bulk
  .setBatchSize(1000)
  .create(50000); // Creates 50k users efficiently

// Factory traits for reusable modifications
import { trait } from 'ilana-orm';

const premiumTrait = trait<User>(factory => 
  factory.state('premium')
);

const user = await User.factory()
  .configure(factory => premiumTrait.apply(factory))
  .create();

// Global sequence management
import { globalSequence, resetGlobalSequence } from 'ilana-orm';

const userFactory = defineFactory(User, () => ({
  name: faker.person.fullName(),
  email: `user${globalSequence('user')}@example.com`
}));

// Reset sequences when needed
resetGlobalSequence('user');
```

## Advanced Features

### Collections

IlanaORM returns Laravel-style Collections with powerful data manipulation methods:

```typescript
// Query returns Collection instance
const users = await User.all(); // Returns Collection<User>

// Static factory methods
const collection = Collection.make([1, 2, 3, 4, 5]);
const numbers = Collection.range(1, 10);
const items = Collection.times(5, i => ({ id: i, name: `Item ${i}` }));

// Data manipulation
const activeUsers = users.filter(user => user.is_active);
const userNames = users.pluck('name');
const uniqueRoles = users.pluck('role').unique();
const usersByRole = users.groupBy('role');
const sortedUsers = users.sortBy('created_at');

// Advanced operations
const [admins, regular] = users.partition(user => user.is_admin);
const userMap = users.keyBy('id');
const roleCounts = users.countBy('role');
const randomUsers = users.random(3);
const shuffled = users.shuffle();

// Functional programming
const result = users
  .filter(user => user.is_active)
  .take(10)
  .tap(collection => console.log(`Processing ${collection.length} users`))
  .pipe(collection => collection.pluck('email'))
  .when(someCondition, collection => collection.unique())
  .unless(otherCondition, collection => collection.shuffle());

// Aggregations
const totalSalary = users.sum('salary');
const averageAge = users.avg('age');
const oldestUser = users.max('age');
const youngestUser = users.min('age');

// Chunking
const chunks = users.chunk(100);
chunks.forEach(chunk => {
  console.log(`Processing chunk of ${chunk.length} users`);
});

// Conditional operations
users
  .whenEmpty(collection => console.log('No users found'))
  .whenNotEmpty(collection => console.log(`Found ${collection.length} users`));
```

### Soft Deletes

```typescript
class User extends Model {
  protected static softDeletes = true;
}

// Soft delete
await user.delete(); // Sets deleted_at timestamp

// Query with trashed records
const users = await User.withTrashed().get();

// Only trashed records
const trashedUsers = await User.onlyTrashed().get();

// Restore soft deleted record
await user.restore();

// Force delete (permanent)
await user.forceDelete();

// Check if model is trashed
if (user.trashed()) {
  console.log('User is soft deleted');
}
```

### Pagination

```typescript
// Basic pagination
const result = await User.query().paginate(1, 15);
// {
//   data: User[],
//   total: 100,
//   perPage: 15,
//   currentPage: 1,
//   lastPage: 7,
//   from: 1,
//   to: 15
// }

// Simple pagination (no total count)
const result = await User.query().simplePaginate(1, 15);
// { data: User[], hasMore: boolean }

// Enhanced cursor pagination (for large datasets)
const result = await User.query()
  .orderBy('id', 'desc')
  .cursorPaginate(15, cursor, 'id', 'desc');
// {
//   data: User[],
//   nextCursor?: string,
//   prevCursor?: string,
//   hasNextPage: boolean,
//   hasPrevPage: boolean,
//   path: string,
//   perPage: number
// }
```

### Chunking

```typescript
// Process records in chunks
await User.query().chunk(100, async (users) => {
  for (const user of users) {
    await processUser(user);
  }
});

// Memory efficient iteration with configurable chunk size
for await (const user of User.query().lazy(500)) {
  await processUser(user);
}

// Cursor-based iteration for large datasets
for await (const user of User.query().cursor(1000)) {
  await processUser(user);
}
```

### Transactions

```typescript
import { Database } from 'ilana-orm';

// Basic transaction
await Database.transaction(async (trx) => {
  const user = await User.create({ name: 'John' });
  const post = await Post.create({ title: 'Hello', user_id: user.id });
  
  if (someCondition) {
    throw new Error('Rollback transaction');
  }
});

// Manual transaction control
const trx = await Database.beginTransaction();

try {
  const user = await User.create({ name: 'John' }, { transaction: trx });
  await trx.commit();
} catch (error) {
  await trx.rollback();
  throw error;
}
```

### Multiple Database Connections

```typescript
// Use specific connection
const users = await User.on('mysql_secondary').get();

// Model with specific connection
class AnalyticsData extends Model {
  protected static connection = 'analytics_db';
}

// Runtime connection switching
const users = await User.query()
  .connection('reporting_db')
  .get();
```

## TypeScript Support

### Type-Safe Models

```typescript
import { Model } from 'ilana-orm';

interface UserAttributes {
  id: number;
  name: string;
  email: string;
  age?: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

class User extends Model<UserAttributes> {
  protected static table = 'users';
  
  // Typed attributes
  declare id: number;
  declare name: string;
  declare email: string;
  declare age?: number;
  declare is_active: boolean;
  declare created_at: Date;
  declare updated_at: Date;
  
  // Typed relationships
  posts(): HasMany<Post> {
    return this.hasMany(Post, 'user_id');
  }
}
```

### Generic Query Builder

```typescript
// Type-safe queries
const users: User[] = await User.query()
  .where('is_active', true)
  .where('age', '>', 18)
  .get();

// Type-safe factory
const user = await User.factory().create({
  name: 'John Doe', // TypeScript validates this
  email: 'john@example.com'
});
```

## Performance & Best Practices

### Query Optimization

```typescript
// Use select to limit columns
const users = await User.query()
  .select('id', 'name', 'email')
  .get();

// Avoid N+1 queries with eager loading
const users = await User.with('posts', 'profile').get();

// Use exists instead of loading relations for checks
const usersWithPosts = await User.query()
  .whereHas('posts')
  .get();

// Use chunking for large datasets
await User.query().chunk(1000, async (users) => {
  await processUsers(users);
});
```

### Security Best Practices

```typescript
class User extends Model {
  // Always use fillable or guarded
  protected fillable = ['name', 'email', 'password'];
  
  // Hide sensitive data
  protected hidden = ['password', 'remember_token'];
  
  // Use mutators for sensitive data
  setPasswordAttribute(value: string) {
    this.attributes.password = bcrypt.hashSync(value, 10);
  }
}

// Use parameterized queries
const users = await User.query()
  .where('email', email) // Safe
  .get();

// Avoid raw queries with user input
// Bad: whereRaw(`name = '${userInput}'`)
// Good: whereRaw('name = ?', [userInput])
```

### Model Organization

```typescript
class User extends Model {
  // 1. Static properties
  protected static table = 'users';
  protected static softDeletes = true;
  
  // 2. Instance properties
  protected fillable = ['name', 'email'];
  protected hidden = ['password'];
  protected casts = {
    email_verified_at: 'date' as const
  };
  
  // 3. Relationships
  posts() {
    return this.hasMany(Post, 'user_id');
  }
  
  // 4. Scopes
  static scopeActive(query: any) {
    return query.where('is_active', true);
  }
  
  // 5. Accessors/Mutators
  getFullNameAttribute(): string {
    return `${this.first_name} ${this.last_name}`;
  }
  
  // 6. Custom methods
  async sendWelcomeEmail(): Promise<void> {
    // Implementation
  }
}
```

## Testing

### Model Testing

```typescript
import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import User from '../models/User';
import { Database } from 'ilana-orm';

describe('User Model', () => {
  beforeEach(async () => {
    await Database.migrate();
  });
  
  afterEach(async () => {
    await Database.rollback();
  });
  
  it('should create a user', async () => {
    const user = await User.create({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password'
    });
    
    expect(user.id).to.exist;
    expect(user.name).to.equal('John Doe');
  });
  
  it('should have posts relationship', async () => {
    const user = await User.factory().create();
    await Post.factory().times(3).create({ user_id: user.id });
    
    const userWithPosts = await User.with('posts').find(user.id);
    expect(userWithPosts.posts).to.have.length(3);
  });
});
```

### Factory Testing

```typescript
describe('User Factory', () => {
  it('should create user with factory', async () => {
    const user = await User.factory().create();
    
    expect(user.name).to.exist;
    expect(user.email).to.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });
  
  it('should create admin user with state', async () => {
    const admin = await User.factory().state('admin').create();
    
    expect(admin.role).to.equal('admin');
    expect(admin.is_admin).to.be.true;
  });
});
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see the [LICENSE](LICENSE) file for details.

---

**IlanaORM** - Following the patterns and protocols of modern database interaction.