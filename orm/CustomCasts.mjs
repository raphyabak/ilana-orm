// CustomCasts.mjs - ES Module wrapper
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const CustomCasts = require('./CustomCasts.js');

export const { MoneyCast, EncryptedCast, JsonCast, ArrayCast, DateCast } = CustomCasts;