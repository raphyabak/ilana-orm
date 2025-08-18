// Model.mjs - ES Module wrapper
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const Model = require('./Model.js');

export default Model;