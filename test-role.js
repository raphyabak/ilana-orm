const Model = require('./orm/Model');

class Role extends Model {
  static table = 'roles';
  static timestamps = true;
  static softDeletes = false;

  fillable = ['name', 'description', 'permissions'];
  hidden = [];
  casts = {
    permissions: 'json',
    created_at: 'date',
    updated_at: 'date'
  };

  // Use string reference instead of importing User
  users() {
    return this.belongsToMany('User', 'user_roles', 'role_id', 'user_id');
  }

  static {
    this.register();
  }
}

module.exports = Role;