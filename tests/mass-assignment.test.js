/**
 * Regression tests for the mass-assignment silent no-op, and its opt-in fix.
 *
 * Model.fill()/update() has always silently dropped any key not covered by
 * `fillable`/`guarded`. On a model that never declared `fillable` (guarded
 * defaults to ['*'], meaning nothing is fillable), a call like
 * `user.update({ age: 33 })` looks like a normal successful update — no
 * error, isDirty() cleanly false, save() resolves true — while writing
 * nothing at all.
 *
 * That silent-drop behavior is unchanged by default (existing apps on any
 * prior release keep working identically). Setting
 * `static preventsSilentlyDiscardingAttributes = true` on a model opts it
 * into throwing MassAssignmentException instead, for ANY discarded key (not
 * just when every key is rejected) — mirroring Eloquent's
 * preventSilentlyDiscardingAttributes(), which is also opt-in there.
 *
 * Factory-generated data (trusted, programmatic, not user input) uses the
 * forceFill() escape hatch instead of fill(), so factories are unaffected by
 * this flag either way — trusted data should never be subject to
 * mass-assignment guarding at all, regardless of a model's strictness
 * setting for its user-facing update() calls.
 */

const Model = require('../orm/Model');
const { MassAssignmentException } = require('../orm/Errors');

describe('mass assignment guarding is silent by default (unchanged behavior)', () => {
  class NoFillableUser extends Model {
    static table = 'users';
  }

  class PartiallyFillableUser extends Model {
    static table = 'users';
    static fillable = ['name'];
  }

  test('fill() silently drops every key when nothing is fillable — default behavior', () => {
    const user = new NoFillableUser({ id: 1, name: 'Ada' });
    expect(() => user.fill({ age: 33 })).not.toThrow();
    expect(user.getAttribute('age')).toBeUndefined();
  });

  test('the exact reported footgun is still possible by default, unless opted out of', async () => {
    const user = new NoFillableUser({ id: 1, name: 'Ada' });
    user.exists = true;
    user.syncOriginal();

    await expect(user.update({ age: 33 })).resolves.toBe(true);
    expect(user.isDirty()).toBe(false); // nothing was actually written
  });

  test('fill() silently drops non-fillable keys alongside fillable ones', () => {
    const user = new PartiallyFillableUser({ id: 1, name: 'Ada', age: 30 });
    expect(() => user.fill({ name: 'Grace', role: 'admin' })).not.toThrow();
    expect(user.getAttribute('name')).toBe('Grace');
    expect(user.getAttribute('role')).toBeUndefined();
  });

  test('fill() with an empty object is a no-op', () => {
    const user = new NoFillableUser({ id: 1, name: 'Ada' });
    expect(() => user.fill({})).not.toThrow();
  });
});

describe('preventsSilentlyDiscardingAttributes = true (opt-in strict mode)', () => {
  class StrictUser extends Model {
    static table = 'users';
    static preventsSilentlyDiscardingAttributes = true;
  }

  class StrictPartiallyFillableUser extends Model {
    static table = 'users';
    static fillable = ['name'];
    static preventsSilentlyDiscardingAttributes = true;
  }

  test('fill() throws when every key is rejected', () => {
    const user = new StrictUser({ id: 1, name: 'Ada' });
    expect(() => user.fill({ age: 33 })).toThrow(MassAssignmentException);
    expect(() => user.fill({ age: 33 })).toThrow(/\[age\] are not fillable/i);
  });

  test('fill() throws even when only SOME keys are rejected (stricter than the default)', () => {
    const user = new StrictPartiallyFillableUser({ id: 1, name: 'Ada', age: 30 });
    expect(() => user.fill({ name: 'Grace', role: 'admin' })).toThrow(MassAssignmentException);
    // and the fillable key is still applied before the throw is raised —
    // matches Eloquent's own behavior of applying what it can first
    expect(user.getAttribute('name')).toBe('Grace');
  });

  test('the exact reported footgun now throws via update() once opted in', async () => {
    const user = new StrictUser({ id: 1, name: 'Ada' });
    user.exists = true;
    user.syncOriginal();

    await expect(user.update({ age: 33 })).rejects.toThrow(MassAssignmentException);
    expect(user.isDirty()).toBe(false);
  });

  test('fill() with an empty object still does not throw', () => {
    const user = new StrictUser({ id: 1, name: 'Ada' });
    expect(() => user.fill({})).not.toThrow();
  });

  test('MassAssignmentException carries the model name, discarded keys, and a 422 response', () => {
    const user = new StrictUser({ id: 1 });
    try {
      user.fill({ age: 33, role: 'admin' });
      throw new Error('expected fill() to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(MassAssignmentException);
      expect(e.model).toBe('StrictUser');
      expect(e.discardedKeys).toEqual(['age', 'role']);
      expect(e.toResponse()).toEqual({ status: 422, message: e.message });
    }
  });
});

describe('forceFill() always bypasses the guard, regardless of the strict flag', () => {
  class StrictUser extends Model {
    static table = 'users';
    static preventsSilentlyDiscardingAttributes = true;
  }

  test('forceFill() applies everything with no error even in strict mode', () => {
    const user = new StrictUser({ id: 1, name: 'Ada' });
    expect(() => user.forceFill({ age: 33, role: 'admin' })).not.toThrow();
    expect(user.getAttribute('age')).toBe(33);
    expect(user.getAttribute('role')).toBe('admin');
  });
});

describe('Factory keeps working regardless of preventsSilentlyDiscardingAttributes', () => {
  const { defineFactory } = require('../orm/Factory');

  class FactoryUser extends Model {
    static table = 'users';
    static timestamps = false;
    static preventsSilentlyDiscardingAttributes = true; // the stricter case
  }

  test('makeOne() populates all defined attributes via forceFill, not fill()', async () => {
    const factory = defineFactory(FactoryUser, () => ({ name: 'Ada', age: 30 }));
    const user = await factory.makeOne();
    expect(user.getAttribute('name')).toBe('Ada');
    expect(user.getAttribute('age')).toBe(30);
  });
});
