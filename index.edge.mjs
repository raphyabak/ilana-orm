// Edge runtime entry point — ESM wrapper.
// Sets __ILANA_EDGE__ before any model is loaded so the auto-loader is skipped.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

globalThis.__ILANA_EDGE__ = true;
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
  ModelNotFoundException,
  F,
  HasOne,
  HasMany,
  BelongsTo,
  BelongsToMany,
  HasManyThrough,
  MorphTo,
  MorphOne,
  MorphMany,
  MoneyCast,
  EncryptedCast,
  JsonCast,
  ArrayCast,
  DateCast,
} = exports;

export default exports.Model;
