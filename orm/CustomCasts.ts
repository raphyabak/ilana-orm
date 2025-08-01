import { CustomCast } from './Model';

export class MoneyCast implements CustomCast {
  get(value: any): number | null {
    return value ? parseFloat(value) / 100 : null;
  }
  
  set(value: any): number | null {
    return value ? Math.round(value * 100) : null;
  }
}

export class EncryptedCast implements CustomCast {
  private key: string;
  
  constructor(key: string = 'default-key') {
    this.key = key;
  }
  
  get(value: any): string | null {
    if (!value) return null;
    // Simple base64 decode for demo - use proper encryption in production
    try {
      return Buffer.from(value, 'base64').toString('utf8');
    } catch {
      return value;
    }
  }
  
  set(value: any): string | null {
    if (!value) return null;
    // Simple base64 encode for demo - use proper encryption in production
    return Buffer.from(value).toString('base64');
  }
}

export class JsonCast implements CustomCast {
  get(value: any): any {
    if (!value) return null;
    return typeof value === 'string' ? JSON.parse(value) : value;
  }
  
  set(value: any): string | null {
    if (value === null || value === undefined) return null;
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
}

export class ArrayCast implements CustomCast {
  get(value: any): any[] | null {
    if (!value) return null;
    return Array.isArray(value) ? value : JSON.parse(value);
  }
  
  set(value: any): string | null {
    if (!value) return null;
    return Array.isArray(value) ? JSON.stringify(value) : value;
  }
}

export class DateCast implements CustomCast {
  get(value: any): Date | null {
    if (!value) return null;
    return new Date(value);
  }
  
  set(value: any): string | null {
    if (!value) return null;
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }
}

export default {
  MoneyCast,
  EncryptedCast,
  JsonCast,
  ArrayCast,
  DateCast
};