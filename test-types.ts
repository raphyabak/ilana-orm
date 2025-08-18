// Test TypeScript declarations
import Model from './orm/Model';
import QueryBuilder from './orm/QueryBuilder';
import Collection from './orm/Collection';
import Database from './database/connection';

// Test Model usage
class User extends Model {
  protected static table = 'users';
  protected fillable = ['name', 'email'];
}

// Test QueryBuilder usage
async function testQuery() {
  const users = await User.query().where('active', true).get();
  const user = await User.find(1);
  return users;
}

// Test Collection usage
function testCollection() {
  const collection = new Collection([1, 2, 3]);
  return collection.map(x => x * 2);
}

console.log('TypeScript declarations test passed!');