const crypto = require('crypto');

function checksum(str) {
  return crypto
    .createHash('md5')
    .update(str, 'utf8')
    .digest('hex');
}

module.exports.checksum = checksum;