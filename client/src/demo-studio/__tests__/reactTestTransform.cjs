// React test fixtures must not change the application's inherited environment.
module.exports = {
  process(source) {
    return { code: source.replace(/process\.env\.NODE_ENV/g, '"development"') };
  },
};
