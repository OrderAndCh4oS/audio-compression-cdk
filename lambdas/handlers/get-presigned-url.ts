import {S3} from "aws-sdk";
import * as crypto from 'crypto';
const BUCKET_NAME = process.env.BUCKET_NAME;

if(!BUCKET_NAME) throw new Error('Missing BUCKET_NAME')

const s3 = new S3({signatureVersion: 'v4'});

const generateUuid = () => {
  return [4, 2, 2, 2, 6]
      .map(group => crypto.randomBytes(group).toString('hex'))
      .join('-');
};

exports.handler = async function(event: any) {

  const fileType = event.queryStringParameters?.fileType

  if (!fileType) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "http://localhost:3000"
      },
      body: JSON.stringify('Missing fileType query parameter')
    };
  }

  const filePath = generateUuid();

  const presignedPost = s3.createPresignedPost({
    Bucket: BUCKET_NAME,
    Fields: {key: filePath, acl: 'public-read'},
    // Todo: Set a fixed filetype. Pull this data from the event.body
    Conditions: [
      ['content-length-range', 0, 100000000],
      ['eq', '$Content-Type', fileType],
    ],
    Expires: 120,
  });

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "http://localhost:3000"
    },
    body: JSON.stringify({...presignedPost, filePath})
  };
};
