const CryptoJS = require('crypto-js');

const characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function randomString(length) {
  var result = '';
  for (var i = length; i > 0; --i) result += characters[Math.floor(Math.random() * characters.length)];
  return result;
}

const crypt = {
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

crypt.salt = function (salt) {
  return crypt.aes(salt);
}

crypt.generateKey = function () {
  return randomString(32); // 512 bits
};

module.exports = crypt;