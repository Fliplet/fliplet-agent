const _ = require('lodash');
const axios = require('axios');

const version = require('../package').version;
const userAgent = `Fliplet Agent/${version}`;

const regions = {
  eu: 'https://api.fliplet.com',
  us: 'https://us.api.fliplet.com',
  ca: 'https://ca.api.fliplet.com'
};

const API = function (authToken, baseURL) {
  if (!authToken) {
    log.critical('Auth token is required');
  }

  this.region = authToken.substr(0, 2).toLowerCase();
  this.authToken = authToken;
  this.baseURL = baseURL || regions[this.region] || regions.eu;

  log.info(`[API] User Agent for outgoing HTTP requests has been set to ${userAgent}`);
  log.debug(`[API] Regional URL has been set to ${this.baseURL}`);

  axios.defaults.baseURL = this.baseURL;
  axios.defaults.headers.common['Auth-token'] = this.authToken;
  axios.defaults.headers.common['User-Agent'] = userAgent;
  axios.defaults.timeout = 60000;
};

API.prototype.authenticate = async function () {
  try {
    const response = await this.request({
      url: 'v1/user'
    });

    return response;
  } catch (error) {
    log.info(`[API] Authentication failed: ${error.message}`);
    return { isAuthFailed: true };
  }
};

API.prototype.logFailedRequest = async function (dataSourceId) {
  if (!dataSourceId) {
    return;
  }

  await this.request({
    url: `v1/data-sources/${dataSourceId}/data`,
    method: 'GET'
  })
}

API.prototype.request = function (options) {
  return axios(options).catch(function (err) {
    if (err.response && err.response.data && err.response.data.message) {
      return Promise.reject(new Error(err.response.data.message));
    }

    return Promise.reject(err);
  });
};

module.exports = API;