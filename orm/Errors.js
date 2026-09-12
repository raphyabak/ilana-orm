class ModelNotFoundException extends Error {
  constructor(model, id) {
    const message = id !== undefined
      ? `${model} with id ${id} not found`
      : `${model} not found`;
    super(message);
    this.name = 'ModelNotFoundException';
    this.model = model;
    this.id = id;
    if (Error.captureStackTrace) Error.captureStackTrace(this, ModelNotFoundException);
  }

  toResponse() {
    return { status: 404, message: this.message };
  }
}

class MassAssignmentException extends Error {
  constructor(model, attemptedKeys) {
    const keys = attemptedKeys.join(', ');
    super(
      `Mass assignment blocked on ${model}: none of [${keys}] are fillable. ` +
      `Add the intended column(s) to ${model}.fillable, adjust ${model}.guarded, ` +
      `or set the attribute(s) directly (e.g. instance.column = value) instead of ` +
      `going through fill()/update().`
    );
    this.name = 'MassAssignmentException';
    this.model = model;
    this.attemptedKeys = attemptedKeys;
    if (Error.captureStackTrace) Error.captureStackTrace(this, MassAssignmentException);
  }

  toResponse() {
    return { status: 422, message: this.message };
  }
}

module.exports = { ModelNotFoundException, MassAssignmentException };
