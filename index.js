function createLib (execlib) {
  return require('./libindex')(execlib);
}
module.exports = createLib;
