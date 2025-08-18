// index.mjs - ES Module wrapper
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const exports = require('./index.js');

export const {
  Model,
  QueryBuilder,
  Collection,
  Database,
  DB,
  SchemaBuilder,
  MigrationRunner,
  Seeder,
  Factory,
  defineFactory,
  Relation,
  HasOne,
  HasMany,
  BelongsTo,
  BelongsToMany,
  HasManyThrough,
  MorphTo,
  MorphMany,
  MoneyCast,
  EncryptedCast,
  JsonCast,
  ArrayCast,
  DateCast
} = exports;

export default exports.Model;