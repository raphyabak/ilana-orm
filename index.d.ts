export { default as Model } from './orm/Model';
export { default as QueryBuilder } from './orm/QueryBuilder';
export { default as Collection } from './orm/Collection';
export { default as Database } from './database/connection';
export * from './orm/Relation';
export * from './orm/CustomCasts';

export declare class FExpression {
  constructor(column: string);
  plus(n: number): any;
  minus(n: number): any;
  times(n: number): any;
  divide(n: number): any;
}
export declare function F(column: string): FExpression;

export declare class ModelNotFoundException extends Error {
  name: 'ModelNotFoundException';
  model: string;
  id?: any;
  constructor(model: string, id?: any);
  toResponse(): { status: 404; message: string };
}

// Default export
export { default } from './orm/Model';