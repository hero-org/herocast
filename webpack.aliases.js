const path = require('path');
const cwd = process.cwd();

function createWebpackAliases(aliases) {
  const result = {};
  for (const name in aliases) {
    result[name] = path.join(cwd, aliases[name]);
  }
  return result;
}

module.exports = createWebpackAliases({
  '@src': 'src',
});
