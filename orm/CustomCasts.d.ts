export interface Cast {
  get(value: any): any;
  set(value: any): any;
}

export class MoneyCast implements Cast {
  get(value: any): number | null;
  set(value: any): number | null;
}

export class EncryptedCast implements Cast {
  constructor(key?: string);
  get(value: any): string | null;
  set(value: any): string | null;
}

export class JsonCast implements Cast {
  get(value: any): any;
  set(value: any): string | null;
}

export class ArrayCast implements Cast {
  get(value: any): any[] | null;
  set(value: any): string | null;
}

export class DateCast implements Cast {
  get(value: any): Date | null;
  set(value: any): string | null;
}