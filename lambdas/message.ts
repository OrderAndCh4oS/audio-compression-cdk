import {ApiGatewayManagementApi, DynamoDB} from 'aws-sdk';

const tableName = process.env.TABLE_NAME;
const partitionKey = process.env.PARTITION_KEY;

if (!tableName) {
    throw new Error('tableName not specified in process.env.TABLE_NAME');
}

if (!partitionKey) {
    throw new Error('tableName not specified in process.env.TABLE_NAME');
}

const ddb = new DynamoDB.DocumentClient({apiVersion: '2012-08-10', region: process.env.AWS_REGION});

export const handler = async (event: any) => {
    let connectionData;

    if (!event.body) {
        throw new Error('event body is missing');
    }

    try {
        connectionData = await ddb.scan({TableName: tableName, ProjectionExpression: 'connectionId'}).promise();
    } catch (e: any) {
        return {statusCode: 500, body: e.stack};
    }

    const apigwManagementApi = new ApiGatewayManagementApi({
        apiVersion: '2018-11-29',
        endpoint: event.requestContext.domainName + '/' + event.requestContext.stage,
    });

    const postData = JSON.parse(event.body).data;

    const postCalls = (connectionData.Items ?? []).map(async ({connectionId}) => {
        try {
            await apigwManagementApi.postToConnection({ConnectionId: connectionId, Data: postData}).promise();
        } catch (e: any) {
            if (e.statusCode === 410) {
                console.log(`Found stale connection, deleting ${connectionId}`);
                await ddb.delete({TableName: tableName, Key: {connectionId}}).promise();
            } else {
                throw e;
            }
        }
    });

    try {
        await Promise.all(postCalls);
    } catch (e: any) {
        return {statusCode: 500, body: e.stack};
    }

    return {statusCode: 200, body: 'Data sent.'};
};
