// Main exports
const Model = require('./orm/Model');
const QueryBuilder = require('./orm/QueryBuilder');
const Collection = require('./orm/Collection');
const Database = require('./database/connection');
const DB = require('./database/DB');
const SchemaBuilder = require('./database/schema-builder');
const MigrationRunner = require('./orm/MigrationRunner');
const Seeder = require('./orm/Seeder');
const Factory = require('./orm/Factory');
const Relation = require('./orm/Relation');
const CustomCasts = require('./orm/CustomCasts');

module.exports = {
  Model,
  QueryBuilder,
  Collection,
  Database,
  DB,
  SchemaBuilder,
  MigrationRunner,
  Seeder,
  Factory: Factory.Factory,
  defineFactory: Factory.defineFactory,
  
  // Relationships
  ...Relation,
  
  // Custom Casts
  ...CustomCasts
};

// Default export
module.exports.default = module.exports.Model;