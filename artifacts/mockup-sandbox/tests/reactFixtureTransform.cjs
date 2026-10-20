// Select React's development test runtime without changing process.env.
// The workspace can intentionally run its application in production mode.
module.exports = {
  process(source) {
    return { code: source.replace(/process\.env\.NODE_ENV/g, '"test"') };
  },
};
