var AWS = require('aws-sdk');
var s3 = new AWS.S3({
  signatureVersion: 'v4',
});

exports.handler = async function(event) {
  const url = s3.getSignedUrl('putObject', {
    Bucket: 'cdkworkshopstack-bucket83908e77-1ojw9gyxpwhp2',
    Key: 'UploadedFile',
    Expires: 600,
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/plain" },
    body: url
  };
};
