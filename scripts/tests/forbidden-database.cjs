class ForbiddenConnection {
  constructor() { throw new Error("AUTH_VALIDATION_OFFLINE: database connections are forbidden"); }
}
module.exports = { Pool: ForbiddenConnection, Client: ForbiddenConnection };
