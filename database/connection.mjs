// connection.mjs - ES Module wrapper
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const Database = require('./connection.js');

export default Database;