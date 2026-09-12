/**
 * Regression tests for the mass-assignment silent no-op.
 *
 * Model.fill()/update() previously dropped any key not in `fillable` (or
 * blocked by `guarded`) with zero signal. On a model that never declared
 * `fillable` (guarded defaults to ['*'], meaning nothing is fillable), a
 * call like `user.update({ age: 33 })` looked like a normal successful
 * update — no error, isDirty() cleanly false, save() resolved true — but
 * silently wrote nothing at all.
 *
 * fill() now throws MassAssignmentException when every single key in the
 * given object was rejected by fillable/guarded, since a legitimate "pass
 * some extra harmless keys" call still gets at least one real column
 * through — a 100%-rejected call is essentially always a forgotten
 * `fillable` declaration, not an intentional no-op.
 *
 * Factory-generated data (trusted, programmatic, not user input) now uses
 * the new forceFill() escape hatch instead of fill(), so factories keep
 * working on models that never declared `fillable` — otherwise this fix
 * would have made Factory.create()/make() throw for that (very common)
 * case.
 */

const Model = require('../orm/Model');
const { MassAssignmentException } = require('../orm/Errors');

describe('mass assignment guarding', () => {
  class NoFillableUser extends Model {
    static table = 'users';
  }

  class PartiallyFillableUser extends Model {
    static table = 'users';
    static fillable = ['name'];
  }

  test('fill() throws MassAssignmentException when every key is rejected', () => {
    const user = new NoFillableUser({ id: 1, name: 'Ada' });
    user.exists = true;
    user.syncOriginal();

    expect(() => user.fill({ age: 33 })).toThrow(MassAssignmentException);
    expect(() => user.fill({ age: 33 })).toThrow(/none of \[age\] are fillable/i);
  });

  test('the exact reported footgun: update() no longer silently no-ops', async () => {
    const user = new NoFillableUser({ id: 1, name: 'Ada' });
    user.exists = true;
    user.syncOriginal();

    await expect(user.update({ age: 33 })).rejects.toThrow(MassAssignmentException);
    // and critically: nothing was marked dirty / no write was attempted
    expect(user.isDirty()).toBe(false);
  });

  test('fill() with an empty object is a legitimate no-op, not an error', () => {
    const user = new NoFillableUser({ id: 1, name: 'Ada' });
    expect(() => user.fill({})).not.toThrow();
  });

  test('fill() still silently drops non-fillable keys when at least one key is fillable', () => {
    const user = new PartiallyFillableUser({ id: 1, name: 'Ada', age: 30 });
    user.exists = true;
    user.syncOriginal();

    // 'name' is fillable, 'role' is not — this is the legitimate
    // "pass extra harmless keys" case and must NOT throw.
    expect(() => user.fill({ name: 'Grace', role: 'admin' })).not.toThrow();
    expect(user.getAttribute('name')).toBe('Grace');
    expect(user.getAttribute('role')).toBeUndefined();
  });

  test('forceFill() bypasses fillable/guarded entirely for trusted/programmatic data', () => {
    const user = new NoFillableUser({ id: 1, name: 'Ada' });
    expect(() => user.forceFill({ age: 33, role: 'admin' })).not.toThrow();
    expect(user.getAttribute('age')).toBe(33);
    expect(user.getAttribute('role')).toBe('admin');
  });

  test('MassAssignmentException carries the model name and rejected keys, and a 422 response', () => {
    const user = new NoFillableUser({ id: 1 });
    try {
      user.fill({ age: 33, role: 'admin' });
      throw new Error('expected fill() to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(MassAssignmentException);
      expect(e.model).toBe('NoFillableUser');
      expect(e.attemptedKeys).toEqual(['age', 'role']);
      expect(e.toResponse()).toEqual({ status: 422, message: e.message });
    }
  });
});

describe('Factory keeps working on models with no fillable declared', () => {
  const { defineFactory } = require('../orm/Factory');

  class FactoryUser extends Model {
    static table = 'users';
    static timestamps = false;
  }

  test('makeOne() populates all defined attributes via forceFill, not fill()', async () => {
    const factory = defineFactory(FactoryUser, () => ({ name: 'Ada', age: 30 }));
    const user = await factory.makeOne();
    expect(user.getAttribute('name')).toBe('Ada');
    expect(user.getAttribute('age')).toBe(30);
  });
});
