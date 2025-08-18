// Collection.mjs - ES Module wrapper
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const Collection = require('./Collection.js');

export default Collection;