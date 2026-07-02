# Changelog

## [1.0.19] - 2026-07-02

### Added
- **pgvector search** — `Model.search(text, { provider, limit, distance })` converts text to an embedding and queries by vector similarity. `Model.nearestTo(vector, { limit, distance })` queries by raw vector. Supports `cosine` (`<=>`), `l2` (`<->`), and `inner` (`<#>`) distance operators. Set `static embeddingColumn`, `static embeddingDimensions`, and `static embeddingProvider` on your model. Requires PostgreSQL + pgvector extension (`schema.enableVectorExtension()`).
- **Edge runtime support** — import from `ilana-orm/edge` to skip the `fs`/`path`-based config auto-loader. Required for Cloudflare Workers, Deno, Bun, and Next.js edge routes. Call `Database.configure(config)` explicitly when using the edge entry point.
- **Supabase compatibility** — IlanaORM connects to Supabase out of the box via the `pg` client. Documented connection setup, connection pooler for serverless, and edge runtime usage with Supabase.
- **ULID primary keys** — set `static keyType = 'ulid'` and `static incrementing = false` for 26-character sortable IDs auto-generated on create. Use `char(26)` in migrations. `Model.generateUlid()` is also available directly.
- **UUID `keyType`** — `static keyType = 'uuid'` is now the explicit type for UUID primary keys (previously `'string'`). Both still work.
- **`model.isNot(other)`** — inverse of `model.is()`. Returns `true` when two instances represent different records.
- **`model.replicate(except?)`** — clones a model as a new unsaved instance, excluding primary key and timestamps. Pass an array of additional column names to exclude.
- **`Model.withoutEvents(callback)`** — suppresses all model events (creating, created, saving, etc.) for the duration of the async callback. Useful in seeders and bulk imports.
- **`Model.prunable()` / `Model.prune()`** — define `static prunable()` returning a query for stale records, then call `Model.prune()` to delete them in 1000-record chunks.
- **Pending attributes on scopes** — `query.withPendingAttributes({ col: value })` sets default column values on any model created through that query. Use `query.new(attrs)` or `query.create(attrs)` to apply them.
- **`query.orderBySubquery(callback, direction?)`** — sort results by a value computed in a subquery.
- **`query.addSelect({ alias: (qb) => ... })`** — compute an additional column from a subquery without a join.
- **`query.has(relation, operator?, count?)`** — filter by relation existence with optional count constraint, e.g. `has('posts', '>', 5)`. Defaults to `>= 1` (equivalent to `whereHas`).
- **`Model.withoutTrashed()`** — static shorthand for `Model.query().withoutTrashed()`.
- **`Model.findOrFail(id)`** — static shorthand for `Model.query().findOrFail(id)`.
- **`Model.insertGetId(data)`** — static shorthand for `Model.query().insertGetId(data)`.

### Fixed
- **CLI model template** — removed all commented-out boilerplate (cast examples, UUID comment, relationship stubs, scope stubs). Generated model is now clean with just `table` and `fillable`.
- **CLI pivot model template** — same cleanup; also removed hardcoded `static timestamps = true` (defaults to `true` in the base class).
- **CLI factory template** — removed commented-out attribute examples and the auto-generated `.state('example', ...)` stub.
- **CLI seeder template** — `${Model}.factory()` was wrong (`Model.factory()` does not exist). Fixed to `factory(Model)` with a proper `{ factory }` import from `ilana-orm/orm/Factory`. Added missing ESModule variant.
- **CLI factory template** — added missing ESModule variant (was generating CJS even for ESM projects).
- **Migration templates** — removed `import type { SchemaBuilder } from 'ilana-orm'` and `const { SchemaBuilder } = require('ilana-orm')` from all generated migrations. `schema` is passed as an argument by the runner — it does not need to be imported. Also removed the commented-out `// connection` line.
- **TypeScript definitions** — added `isNot`, `replicate`, `withoutEvents`, `prunable`, `prune`, `generateUlid`, `_generateKey`, `orderBySubquery`, `withPendingAttributes`, `new`, `create` to `Model.d.ts` and `QueryBuilder.d.ts`. Updated `keyType` to include `'uuid' | 'ulid'`.

## [1.0.18] - 2026-06-30

### Added
- **`ModelNotFoundException`** — named error class thrown by `findOrFail()` and `firstOrFail()` instead of a generic `Error`. Includes `model` (class name), `id`, and `toResponse()` → `{ status: 404, message }`. Import with `import { ModelNotFoundException } from 'ilana-orm'`.
- **Query logging** — enable via `logging: true` in `ilana.config.js` or programmatically with `Database.enableLogging()` / `Database.disableLogging()`. Prints every SQL query with bound values and execution time. Generated config now includes `logging: false` with a comment.
- **Enum union types in `npx ilana types`** — `table.enum('role', ['user', 'admin'])` now generates `'user' | 'admin'` instead of `string`.
- **`Model.truncate()`** — deletes all rows in the model's table.
- **`Model.seed(n)`** — creates `n` records using the model's registered factory. Requires `defineFactory` to be called first.
- **`model.fresh()`** — re-fetches the model instance from the database and returns a new instance with up-to-date attributes.
- **`model.is(other)`** — returns `true` if two model instances represent the same database record (same class and primary key).
- **`query.sole()`** — like `firstOrFail()` but also throws if more than one record matches.
- **`query.tap(callback)`** — runs a callback for side effects (e.g. logging, debugging) without breaking the query chain.
- **`F()` expressions** — reference column values in updates without raw SQL: `update({ views: F('views').plus(1) })`. Supports `.plus()`, `.minus()`, `.times()`, `.divide()`. Import with `import { F } from 'ilana-orm'`.
- **Bulk restore** — `Model.query().onlyTrashed().restore()` restores multiple soft-deleted records in one query.
- **Enum helpers** — define `static enums = { role: ['user', 'admin'] }` on a model and get auto-generated `user.isAdmin()` / `user.makeAdmin()` instance methods.
- **`static strictLoading`** — set `static strictLoading = true` on a model to throw when an unloaded relation is accessed without eager loading. Useful for catching N+1 in development.
- **`static touches`** — set `static touches = ['post']` on a model to automatically update the parent's `updated_at` whenever the child saves.
- **`query.values()`** — returns plain objects instead of model instances. Faster for read-heavy endpoints where you only need the raw data.
- **`increment(column, amount?)` / `decrement(column, amount?)`** — on both model instances and the query builder. Instance methods update the local attribute and sync original without a full re-fetch.
- **Factory relationship methods fully implemented** — `has(factory, relation)`, `for(relation, factory)`, and `hasAttached(factory, relation)` now correctly create and wire related models during `create()`. Previously these methods stored the relationship but never acted on it.

## [1.0.17] - 2026-06-30

### Added
- **`npx ilana types`** — generates TypeScript `.d.ts` files for all models. Only runs in TypeScript projects (detected via `tsconfig.json`). Column types are inferred from migration files (`table.string()` → `string`, `table.boolean()` → `boolean`, `.nullable()` → `T | null`, etc.) and cross-referenced with model `casts` (casts take priority). Relation methods are typed with proper return types (`HasMany`, `BelongsTo`, etc.). A barrel `types/index.d.ts` re-exports all models. Output directory defaults to `types/`, customisable with `--out=<dir>`.
- **Auto type generation** — types are regenerated automatically after `make:model`, `migrate`, `migrate:fresh`, and `migrate:refresh`. Silently skipped in non-TypeScript projects.

## [1.0.16] - 2026-06-29

### Fixed

- **Soft deletes**: `static deletedAt`, `createdAt`, `updatedAt` properties were documented as configurable but ignored — all timestamp column names were hardcoded. They are now respected throughout `delete()`, `restore()`, `trashed()`, `save()`, `_softQuery()`, `latest()`, and `oldest()`.
- **`Model.destroy()`**: always performed a hard `DELETE` even on soft-delete models. Now soft-deletes each record individually when `softDeletes = true`, consistent with `instance.delete()`.
- **Soft-delete scope on aggregates**: `count()`, `sum()`, `avg()`, `min()`, `max()`, `exists()`, and `pluck()` were executing against all rows, ignoring the soft-delete filter. Fixed via `_softQuery()`.
- **Soft-delete scope on `get()` / `first()` / `find()`**: soft-delete WHERE clause was applied by mutating `this.query` directly — causing duplicate WHERE clauses on repeated calls to the same builder instance. Fixed with a clone-based `_softQuery()` helper.
- **`paginate()` total count**: ignored soft-delete scope, returning inflated totals when records were soft-deleted.
- **`chunk()` builder mutation**: each iteration mutated the same Knex builder with accumulated `OFFSET`/`LIMIT` and soft-delete filters. Fixed with `this.clone()` per iteration.
- **`whereDoesntHave(relation, callback)`**: the constraint callback was silently dropped. Rewrote to build a proper constrained `WHERE NOT EXISTS` subquery.
- **`whereExists` duplicate definition**: `whereExists` was defined twice in `QueryBuilder.js`; the second definition (added in error) has been removed.
- **SQL injection in `whereJsonContains`, `whereJsonLength`**: column names were interpolated raw into SQL strings. Fixed with Knex `??` identifier binding.
- **SQL injection in `whereDate`, `whereMonth`, `whereYear`, `whereDay`, `whereTime`**: same issue. Fixed with `??` binding and a strict operator whitelist (`_validOp()`).
- **SQL injection in `schema-builder.js`**: `checkPositive`, `checkRegex`, `generatedAs`, `collate`, `fulltext`, `spatial` all interpolated column/table names raw. Fixed with `??` bindings; `checkRegex` pattern is now bound with `?` instead of embedded in a string literal.
- **`whereMonth` / `whereYear` PostgreSQL support**: used MySQL-only `MONTH()`/`YEAR()` functions. Now uses `EXTRACT(MONTH FROM ??)` / `EXTRACT(YEAR FROM ??)` on PostgreSQL.
- **README mutator example**: showed `this.attributes.password = bcrypt.hashSync(value, 10)` — mutators must `return` the value, not assign it. Fixed to `return bcrypt.hashSync(value, 10)`.
- **README factory `evaluator` example**: referenced non-existent `evaluator.hasState()` second argument. Replaced with the correct flag-attribute pattern.
- **Factory dead code branch**: `makeRaw` contained a logically impossible `else if` that could never be reached. Removed.

### Added

- **`unless(condition, callback, otherwise?)`** on `QueryBuilder`: inverse of `when()` — runs the callback when condition is falsy.
- **`getOriginal(key?)`** on `Model`: returns the pre-change snapshot of attributes (or a single key's original value).
- **`Model.withCount()` static**: shorthand for `Model.query().withCount(...)`.
- **`havingRaw(sql, bindings?)`** on `QueryBuilder`: public method (was previously only reachable via `having(rawSql)`).
- **`whereNotExists(callback)`** on `QueryBuilder`: public method for `WHERE NOT EXISTS` subqueries.
- **`from(table)`** on `QueryBuilder`: enables `whereExists(q => q.from('posts').whereRaw(...))` pattern.
- **`llms.txt`**: added for LLM-friendly API reference.

### Updated

- `doesntHave(relation)` now delegates to `whereDoesntHave(relation)` (no behaviour change, reduces duplication).
- `static deletedAt`, `static createdAt`, `static updatedAt` added to `Model.d.ts` as configurable properties.
- `Model` generic type parameter added to `Model.d.ts`: `class Model<TAttributes extends ModelAttributes = ModelAttributes>`.
- `CastInstance` interface added to `Model.d.ts` for custom cast classes.
- `BelongsToMany` pivot methods (`attach`, `detach`, `sync`, `toggle`, `updateExistingPivot`) added to `Relation.d.ts`.
- `QueryBuilder.d.ts`: added `unless`, `havingRaw`, `whereNotExists`, `from`, `withCount`; removed duplicate `whereExists` declaration.
- README: corrected `whereDoesntHave` description, added `orderByRaw` to API reference.

## [1.0.15] - 2024-01-XX

### Changed
- **BREAKING (Minor)**: Database drivers (pg, mysql2, sqlite3) moved to `optionalDependencies`
  - Users must now install database drivers separately: `npm install pg` or `npm install mysql2` or `npm install sqlite3`
  - Reduces package size and security surface
  - Existing users: drivers will still install automatically on `npm install`

### Removed
- Removed `moment-timezone` dependency - replaced with native `Intl.DateTimeFormat` API

### Added
- Helpful error messages when database drivers are not installed
- SECURITY.md file with security guidelines
- Security section in README.md

### Updated
- Updated all dependencies to latest versions:
  - knex: ^3.0.0 → ^3.1.0
  - uuid: ^9.0.0 → ^10.0.0
  - @faker-js/faker: ^8.0.0 → ^9.0.0
  - dotenv: ^16.3.1 → ^16.4.0
  - pg: ^8.0.0 → ^8.13.0 (optional)
  - mysql2: ^3.0.0 → ^3.11.0 (optional)
  - sqlite3: ^5.0.0 → ^5.1.7 (optional)

### Fixed
- Improved timezone handling with native JavaScript APIs
- Better backward compatibility for optional dependencies

## [1.0.14] - Previous Release
