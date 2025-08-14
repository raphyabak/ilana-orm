class Collection extends Array {
  constructor(items = []) {
    super();
    if (items && items.length > 0) {
      this.push(...items);
    }
    Object.setPrototypeOf(this, Collection.prototype);
  }

  // Static factory methods
  static make(items = []) {
    return new Collection(items);
  }

  static times(count, callback) {
    const items = [];
    for (let i = 0; i < count; i++) {
      items.push(callback(i));
    }
    return new Collection(items);
  }

  static range(start, end) {
    const items = [];
    for (let i = start; i <= end; i++) {
      items.push(i);
    }
    return new Collection(items);
  }

  // Collection methods
  filter(callback) {
    return new Collection(super.filter(callback));
  }

  map(callback) {
    return new Collection(super.map(callback));
  }

  first() {
    return this[0];
  }

  last() {
    return this[this.length - 1];
  }

  pluck(key) {
    return new Collection(this.map(item => item[key]));
  }

  unique(key) {
    if (key) {
      const seen = new Set();
      return new Collection(this.filter(item => {
        const value = item[key];
        if (seen.has(value)) {
          return false;
        }
        seen.add(value);
        return true;
      }));
    }
    return new Collection([...new Set(this)]);
  }

  groupBy(key) {
    const groups = {};
    
    for (const item of this) {
      const groupKey = item[key];
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
    }

    const result = {};
    for (const [k, v] of Object.entries(groups)) {
      result[k] = new Collection(v);
    }
    
    return result;
  }

  sortBy(key) {
    return new Collection([...this].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    }));
  }

  sortByDesc(key) {
    return new Collection([...this].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    }));
  }

  where(key, value) {
    return new Collection(this.filter(item => item[key] === value));
  }

  firstWhere(key, value) {
    return this.find(item => item[key] === value);
  }

  sum(key) {
    if (key) {
      return this.reduce((sum, item) => sum + (item[key] || 0), 0);
    }
    return this.reduce((sum, item) => sum + item, 0);
  }

  avg(key) {
    if (this.length === 0) return 0;
    return this.sum(key) / this.length;
  }

  min(key) {
    if (this.length === 0) return undefined;
    
    if (key) {
      return Math.min(...this.map(item => item[key]));
    }
    return Math.min(...this);
  }

  max(key) {
    if (this.length === 0) return undefined;
    
    if (key) {
      return Math.max(...this.map(item => item[key]));
    }
    return Math.max(...this);
  }

  chunk(size) {
    const chunks = [];
    for (let i = 0; i < this.length; i += size) {
      chunks.push(new Collection(this.slice(i, i + size)));
    }
    return new Collection(chunks);
  }



  toJSON() {
    return this.map(item => {
      if (item && typeof item.toJSON === 'function') {
        return item.toJSON();
      }
      return item;
    });
  }

  // Advanced collection methods
  reject(callback) {
    return new Collection(super.filter((item, index) => !callback(item, index)));
  }

  partition(callback) {
    const passed = new Collection();
    const failed = new Collection();
    
    for (let i = 0; i < this.length; i++) {
      if (callback(this[i], i)) {
        passed.push(this[i]);
      } else {
        failed.push(this[i]);
      }
    }
    
    return [passed, failed];
  }

  keyBy(key) {
    const result = {};
    for (const item of this) {
      result[item[key]] = item;
    }
    return result;
  }

  countBy(key) {
    const result = {};
    for (const item of this) {
      const value = item[key];
      result[value] = (result[value] || 0) + 1;
    }
    return result;
  }

  flatten() {
    const result = [];
    for (const item of this) {
      if (Array.isArray(item)) {
        result.push(...item);
      } else {
        result.push(item);
      }
    }
    return new Collection(result);
  }

  take(count) {
    return new Collection(this.slice(0, count));
  }

  skip(count) {
    return new Collection(this.slice(count));
  }

  random(count = 1) {
    const shuffled = [...this].sort(() => 0.5 - Math.random());
    if (count === 1) {
      return shuffled[0];
    }
    return new Collection(shuffled.slice(0, count));
  }

  shuffle() {
    return new Collection([...this].sort(() => 0.5 - Math.random()));
  }

  tap(callback) {
    callback(this);
    return this;
  }

  pipe(callback) {
    return callback(this);
  }

  whenEmpty(callback) {
    if (this.isEmpty()) {
      callback(this);
    }
    return this;
  }

  whenNotEmpty(callback) {
    if (this.isNotEmpty()) {
      callback(this);
    }
    return this;
  }

  unless(condition, callback) {
    if (!condition) {
      callback(this);
    }
    return this;
  }

  when(condition, callback) {
    if (condition) {
      callback(this);
    }
    return this;
  }

  toArray() {
    return [...this];
  }

  isEmpty() {
    return this.length === 0;
  }

  isNotEmpty() {
    return this.length > 0;
  }

  // Ensure proper iterator implementation
  [Symbol.iterator]() {
    return super[Symbol.iterator]();
  }
}

module.exports = Collection;