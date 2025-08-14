class MoneyCast {
  get(value) {
    return value ? parseFloat(value) / 100 : null;
  }
  
  set(value) {
    return value ? Math.round(value * 100) : null;
  }
}

class EncryptedCast {
  constructor(key = 'default-key') {
    this.key = key;
  }
  
  get(value) {
    if (!value) return null;
    // Simple base64 decode for demo - use proper encryption in production
    try {
      return Buffer.from(value, 'base64').toString('utf8');
    } catch {
      return value;
    }
  }
  
  set(value) {
    if (!value) return null;
    // Simple base64 encode for demo - use proper encryption in production
    return Buffer.from(value).toString('base64');
  }
}

class JsonCast {
  get(value) {
    if (!value) return null;
    return typeof value === 'string' ? JSON.parse(value) : value;
  }
  
  set(value) {
    if (value === null || value === undefined) return null;
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
}

class ArrayCast {
  get(value) {
    if (!value) return null;
    return Array.isArray(value) ? value : JSON.parse(value);
  }
  
  set(value) {
    if (!value) return null;
    return Array.isArray(value) ? JSON.stringify(value) : value;
  }
}

class DateCast {
  get(value) {
    if (!value) return null;
    return new Date(value);
  }
  
  set(value) {
    if (!value) return null;
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }
}

module.exports = {
  MoneyCast,
  EncryptedCast,
  JsonCast,
  ArrayCast,
  DateCast
};