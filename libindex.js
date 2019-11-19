function createLib (execlib) {
  return {
    service: require('./servicecreator')(execlib)
  };
}
module.exports = createLib;
