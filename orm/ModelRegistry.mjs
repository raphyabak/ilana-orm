// ModelRegistry.mjs - ES Module wrapper
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const ModelRegistry = require('./ModelRegistry.js');

export default ModelRegistry;