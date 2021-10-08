import * as AWS from 'aws-sdk';

const tableName = process.env.TABLE_NAME;
const partitionKey = process.env.PARTITION_KEY;

if (!tableName) {
    throw new Error('tableName not specified in process.env.TABLE_NAME');
}

if (!partitionKey) {
    throw new Error('tableName not specified in process.env.TABLE_NAME');
}

const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION });

export const handler = async (event: any) => {
    const deleteParams = {
        TableName: tableName,
        Key: {
            [partitionKey]: event.requestContext.connectionId,
        },
    };

    try {
        await ddb.delete(deleteParams).promise();
    } catch (err) {
        return {
            statusCode: 500,
            body: `Failed to disconnect: ${JSON.stringify(err)}`
        };
    }

    return {
        statusCode: 200,
        body: 'Disconnected.'
    };
};
