export class Collection<T = any> extends Array<T> {
  constructor(items: T[] = []) {
    super(...items);
    Object.setPrototypeOf(this, Collection.prototype);
  }

  // Static factory methods
  static make<T>(items: T[] = []): Collection<T> {
    return new Collection(items);
  }

  static times<T>(count: number, callback: (index: number) => T): Collection<T> {
    const items: T[] = [];
    for (let i = 0; i < count; i++) {
      items.push(callback(i));
    }
    return new Collection(items);
  }

  static range(start: number, end: number): Collection<number> {
    const items: number[] = [];
    for (let i = start; i <= end; i++) {
      items.push(i);
    }
    return new Collection(items);
  }

  // Collection methods
  filter(callback: (item: T, index: number) => boolean): Collection<T> {
    return new Collection(super.filter(callback));
  }

  map<U>(callback: (item: T, index: number) => U): Collection<U> {
    return new Collection(super.map(callback));
  }

  first(): T | undefined {
    return this[0];
  }

  last(): T | undefined {
    return this[this.length - 1];
  }

  pluck(key: string): Collection<any> {
    return new Collection(this.map(item => (item as any)[key]));
  }

  unique(key?: string): Collection<T> {
    if (key) {
      const seen = new Set();
      return new Collection(this.filter(item => {
        const value = (item as any)[key];
        if (seen.has(value)) {
          return false;
        }
        seen.add(value);
        return true;
      }));
    }
    return new Collection([...new Set(this)]);
  }

  groupBy(key: string): Record<string, Collection<T>> {
    const groups: Record<string, T[]> = {};
    
    for (const item of this) {
      const groupKey = (item as any)[key];
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
    }

    const result: Record<string, Collection<T>> = {};
    for (const [k, v] of Object.entries(groups)) {
      result[k] = new Collection(v);
    }
    
    return result;
  }

  sortBy(key: string): Collection<T> {
    return new Collection([...this].sort((a, b) => {
      const aVal = (a as any)[key];
      const bVal = (b as any)[key];
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    }));
  }

  sortByDesc(key: string): Collection<T> {
    return new Collection([...this].sort((a, b) => {
      const aVal = (a as any)[key];
      const bVal = (b as any)[key];
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    }));
  }

  where(key: string, value: any): Collection<T> {
    return new Collection(this.filter(item => (item as any)[key] === value));
  }

  firstWhere(key: string, value: any): T | undefined {
    return this.find(item => (item as any)[key] === value);
  }

  sum(key?: string): number {
    if (key) {
      return this.reduce((sum, item) => sum + ((item as any)[key] || 0), 0);
    }
    return this.reduce((sum, item) => sum + (item as number), 0);
  }

  avg(key?: string): number {
    if (this.length === 0) return 0;
    return this.sum(key) / this.length;
  }

  min(key?: string): any {
    if (this.length === 0) return undefined;
    
    if (key) {
      return Math.min(...this.map(item => (item as any)[key]));
    }
    return Math.min(...(this as any));
  }

  max(key?: string): any {
    if (this.length === 0) return undefined;
    
    if (key) {
      return Math.max(...this.map(item => (item as any)[key]));
    }
    return Math.max(...(this as any));
  }

  chunk(size: number): Collection<Collection<T>> {
    const chunks: Collection<T>[] = [];
    for (let i = 0; i < this.length; i += size) {
      chunks.push(new Collection(this.slice(i, i + size)));
    }
    return new Collection(chunks);
  }

  isEmpty(): boolean {
    return this.length === 0;
  }

  isNotEmpty(): boolean {
    return this.length > 0;
  }

  toArray(): T[] {
    return [...this];
  }

  toJSON(): any[] {
    return this.map(item => {
      if (item && typeof (item as any).toJSON === 'function') {
        return (item as any).toJSON();
      }
      return item;
    });
  }

  // Advanced collection methods
  reject(callback: (item: T, index: number) => boolean): Collection<T> {
    return new Collection(super.filter((item, index) => !callback(item, index)));
  }

  partition(callback: (item: T, index: number) => boolean): [Collection<T>, Collection<T>] {
    const passed = new Collection<T>();
    const failed = new Collection<T>();
    
    for (let i = 0; i < this.length; i++) {
      if (callback(this[i], i)) {
        passed.push(this[i]);
      } else {
        failed.push(this[i]);
      }
    }
    
    return [passed, failed];
  }

  keyBy(key: string): Record<string, T> {
    const result: Record<string, T> = {};
    for (const item of this) {
      result[(item as any)[key]] = item;
    }
    return result;
  }

  countBy(key: string): Record<string, number> {
    const result: Record<string, number> = {};
    for (const item of this) {
      const value = (item as any)[key];
      result[value] = (result[value] || 0) + 1;
    }
    return result;
  }

  flatten(): Collection<any> {
    const result: any[] = [];
    for (const item of this) {
      if (Array.isArray(item)) {
        result.push(...item);
      } else {
        result.push(item);
      }
    }
    return new Collection(result);
  }

  take(count: number): Collection<T> {
    return new Collection(this.slice(0, count));
  }

  skip(count: number): Collection<T> {
    return new Collection(this.slice(count));
  }

  random(count: number = 1): Collection<T> | T {
    const shuffled = [...this].sort(() => 0.5 - Math.random());
    if (count === 1) {
      return shuffled[0];
    }
    return new Collection(shuffled.slice(0, count));
  }

  shuffle(): Collection<T> {
    return new Collection([...this].sort(() => 0.5 - Math.random()));
  }

  tap(callback: (collection: this) => void): this {
    callback(this);
    return this;
  }

  pipe<U>(callback: (collection: this) => U): U {
    return callback(this);
  }

  whenEmpty(callback: (collection: this) => void): this {
    if (this.isEmpty()) {
      callback(this);
    }
    return this;
  }

  whenNotEmpty(callback: (collection: this) => void): this {
    if (this.isNotEmpty()) {
      callback(this);
    }
    return this;
  }

  unless(condition: boolean, callback: (collection: this) => void): this {
    if (!condition) {
      callback(this);
    }
    return this;
  }

  when(condition: boolean, callback: (collection: this) => void): this {
    if (condition) {
      callback(this);
    }
    return this;
  }
}

export default Collection;