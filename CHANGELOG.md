# Changelog

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
