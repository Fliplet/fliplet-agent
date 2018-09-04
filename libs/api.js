const API = function (authToken) {
  this.authToken = authToken;
};

API.prototype.authenticate = function () {
  return Promise.resolve();
};

module.exports = API;