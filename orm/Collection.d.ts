export default class Collection<T = any> extends Array<T> {
  constructor(items?: T[]);

  // Static factory methods
  static make<T>(items?: T[]): Collection<T>;
  static times<T>(count: number, callback: (index: number) => T): Collection<T>;
  static range(start: number, end: number): Collection<number>;

  // Collection methods
  filter(callback: (item: T, index: number) => boolean): Collection<T>;
  map<U>(callback: (item: T, index: number) => U): Collection<U>;
  first(): T | undefined;
  last(): T | undefined;
  pluck<K extends keyof T>(key: K): Collection<T[K]>;
  unique(): Collection<T>;
  unique<K extends keyof T>(key: K): Collection<T>;
  groupBy<K extends keyof T>(key: K): { [key: string]: Collection<T> };
  sortBy<K extends keyof T>(key: K): Collection<T>;
  sortByDesc<K extends keyof T>(key: K): Collection<T>;
  where<K extends keyof T>(key: K, value: T[K]): Collection<T>;
  firstWhere<K extends keyof T>(key: K, value: T[K]): T | undefined;
  sum(): number;
  sum<K extends keyof T>(key: K): number;
  avg(): number;
  avg<K extends keyof T>(key: K): number;
  min(): T | undefined;
  min<K extends keyof T>(key: K): T[K] | undefined;
  max(): T | undefined;
  max<K extends keyof T>(key: K): T[K] | undefined;
  chunk(size: number): Collection<Collection<T>>;
  toJSON(): any[];

  // Advanced collection methods
  reject(callback: (item: T, index: number) => boolean): Collection<T>;
  partition(callback: (item: T, index: number) => boolean): [Collection<T>, Collection<T>];
  keyBy<K extends keyof T>(key: K): { [key: string]: T };
  countBy<K extends keyof T>(key: K): { [key: string]: number };
  flatten(): Collection<any>;
  take(count: number): Collection<T>;
  skip(count: number): Collection<T>;
  random(): T | undefined;
  random(count: number): Collection<T>;
  shuffle(): Collection<T>;
  tap(callback: (collection: this) => void): this;
  pipe<U>(callback: (collection: this) => U): U;
  whenEmpty(callback: (collection: this) => void): this;
  whenNotEmpty(callback: (collection: this) => void): this;
  unless(condition: boolean, callback: (collection: this) => void): this;
  when(condition: boolean, callback: (collection: this) => void): this;
  toArray(): T[];
  isEmpty(): boolean;
  isNotEmpty(): boolean;
}