const CryptoJS = require('crypto-js');

/**
 * List of characters to be used when generating a random string as a AES passphrase
 */
const characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Generates a random 32-bytes string to be used for AES
 * @param {Number} length
 */
function randomString(length) {
  var result = '';
  for (var i = length; i > 0; --i) result += characters[Math.floor(Math.random() * characters.length)];
  return result;
}

const crypt = {
  /**
   * Provides handy methods for encrypting and decrypting data using AES
   * @param {String} salt
   */
  aes(salt) {
    return {
      encrypt(text) {
        return CryptoJS.AES.encrypt(text, salt).toString();
      },
      decrypt(text) {
        const bytes = CryptoJS.AES.decrypt(text, salt);
        return bytes.toString(CryptoJS.enc.Utf8);
      }
    };
  }
};

/**
 * Shorthand function for "crypt.aes()"
 */
crypt.salt = function (salt) {
  return crypt.aes(salt);
}

/**
 * Generates a random 32-bytes string to be used for AES
 * @return {String}
 */
crypt.generateKey = function () {
  return randomString(32); // 512 bits
};

module.exports = crypt;