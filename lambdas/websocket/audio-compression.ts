import {ApiGatewayManagementApi} from 'aws-sdk';

export const handler = async (event: any) => {
    if (!event.body) {
        console.log('Missing event.body')
        return {statusCode: 500, body: {error: 'Missing event.body'}};
    }

    console.log('event', JSON.stringify(event))
    console.log('body', JSON.stringify(event.body))

    const postData = JSON.parse(event.body).data;
    const connectionId = event.requestContext.connectionId;

    const managementApi = new ApiGatewayManagementApi({
        apiVersion: '2018-11-29',
        endpoint: event.requestContext.domainName + '/' + event.requestContext.stage,
    });

    // Todo: Handle compression here
    //       On success or failure send message back

    try {
        await managementApi.postToConnection({ConnectionId: connectionId, Data: postData}).promise();
    } catch (e: any) {
        return {statusCode: 500, body: e.stack};
    }

    return {statusCode: 200, body: 'Data sent.'};
};
