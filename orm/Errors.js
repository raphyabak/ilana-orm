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

module.exports = { ModelNotFoundException };
