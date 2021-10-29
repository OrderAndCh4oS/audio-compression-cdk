import {ApiGatewayManagementApi} from "aws-sdk";

const WEBSOCKET_API_ENDPOINT = process.env.WEBSOCKET_API_ENDPOINT;
const STAGE = process.env.STAGE;

if (!WEBSOCKET_API_ENDPOINT) throw new Error('Missing WEBSOCKET_API_ENDPOINT');
if (!STAGE) throw new Error('Missing STAGE');

export const handler = async (event: any) => {
    console.log('event', JSON.stringify(event));

    console.log('ENDPOINT', WEBSOCKET_API_ENDPOINT);

    const endpoint = WEBSOCKET_API_ENDPOINT.slice(6);

    console.log(endpoint);

    const managementApi = new ApiGatewayManagementApi({
        apiVersion: '2018-11-29',
        endpoint: endpoint + '/' + STAGE,
    });

    const status = event.detail.status;
    const connectionId = event.detail.userMetadata.connectionId;

    try {
        await managementApi.postToConnection({ConnectionId: connectionId, Data: status}).promise();
    } catch (e: any) {
        console.log('Stack', e?.stack);
        return {
            statusCode: 500,
            body: {error: 'Failed to post to connections'}
        };
    }

    return {
        statusCode: 200,
        body: 'Connected.'
    };
};
