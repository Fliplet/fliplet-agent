const _ = require('lodash');
const crypto = require('crypto');
const FormData = require('form-data');

module.exports = function (API) {
  let uploadFolder;
  const folderName = `Files uploaded from DIS`;

  function generateChecksum(str) {
    return crypto
      .createHash('md5')
      .update(str, 'utf8')
      .digest('hex');
  }

  function resetState() {
    uploadFolder = null;
  }

  function getUploadFolder() {
    let organizationId;

    if (uploadFolder) {
      return uploadFolder;
    }

    uploadFolder = API.request({
      url: 'v1/organizations/'
    }).then((response) => {
      const organization = _.first(response.data.organizations);
      organizationId = organization.id;

      return API.request({
        url: `v1/media/?organizationId=${organizationId}`
      }).then((response) => {
        const folder = _.find(response.data.folders, (folder) => {
          return folder.name === folderName;
        });

        if (folder) {
          return folder;
        }

        log.debug(`Creating new media folder named "${folderName}" in organization ${organization.name}`);

        return API.request({
          url: `v1/media/folders`,
          method: 'POST',
          data: {
            name: folderName,
            organizationId
          }
        }).then((response) => {
          return response.data;
        });
      });
    }).then((folder) => {
      return API.request({
        url: `v1/media?folderId=${folder.id}&organizationId=${organizationId}`
      }).then((response) => {
        folder.files = response.data.files;
        return folder;
      })
    });

    return uploadFolder;
  }

  /**
   * Upload a file to Fliplet API
   * @param options { Object } - row, operation, url, content, definition
   */
  async function upload(options) {
    const folder = await getUploadFolder();
    const checksum = generateChecksum(options.file.body);
    const fileName = options.file.name;

    let existingFile;

    // Check by checksum
    if (!definition.compare || definition.compare.indexOf('checksum') !== -1) {
      existingFile = _.find(folder.files, (file) => {
        return file.metadata && file.metadata.checksum === checksum;
      });
    }

    // Check by name
    if ((!definition.compare || definition.compare.indexOf('name') !== -1) && !existingFile && fileName) {
      existingFile = _.find(folder.files, (file) => {
        return file.name === fileName;
      });
    }

    if (existingFile) {
      log.debug(`[FILES] File "${fileName}" does not need to be sync as it was uploaded on ${existingFile.createdAt}.`);
      return Promise.resolve(existingFile);
    }

    const formData = new FormData();

    formData.append('files', options.file.body, options.file.name);

    log.info(`[FILES] Uploading ${fileName}`);

    return API.request({
      url: `v1/media/files?folderId=${folder.id}&name=${encodeURIComponent(fileName)}&organizationId=${folder.organizationId}`,
      method: 'POST',
      headers: formData.getHeaders(),
      data: formData
    }).then(result => {
      return result.data.files[0];
    });
  }

  return {
    upload,
    resetState
  }
};