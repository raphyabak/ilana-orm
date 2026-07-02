const Database = require('../database/connection');

class FExpression {
  constructor(column) {
    this.column = column;
  }

  _raw(op, n) {
    return Database.raw(`?? ${op} ?`, [this.column, n]);
  }

  plus(n)   { return this._raw('+', n); }
  minus(n)  { return this._raw('-', n); }
  times(n)  { return this._raw('*', n); }
  divide(n) { return this._raw('/', n); }
}

function F(column) {
  return new FExpression(column);
}

module.exports = { F, FExpression };
