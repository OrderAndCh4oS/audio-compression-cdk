import {S3} from "aws-sdk";
const BUCKET_NAME = process.env.BUCKET_NAME;

if(!BUCKET_NAME) throw new Error('Missing BUCKET_NAME')

const s3 = new S3({signatureVersion: 'v4'});

exports.handler = async function(event: any) {
  const url = s3.getSignedUrl('putObject', {
    Bucket: BUCKET_NAME,
    Key: 'UploadedFile',
    Expires: 600,
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/plain" },
    body: url
  };
};
