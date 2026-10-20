// Select React's test runtime without changing the application's environment.
module.exports = {
  process(source) { return { code: source.replace(/process\.env\.NODE_ENV/g, '"test"') }; },
};
