// Relation.mjs - ES Module wrapper
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const Relations = require('./Relation.js');

export const { Relation, HasOne, HasMany, BelongsTo, BelongsToMany, HasManyThrough, MorphTo, MorphMany } = Relations;