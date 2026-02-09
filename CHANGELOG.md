# Changelog

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
