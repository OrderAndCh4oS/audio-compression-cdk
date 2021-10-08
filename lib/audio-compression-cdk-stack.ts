import * as cdk from '@aws-cdk/core';
import {WebSocketApi, WebSocketStage} from "@aws-cdk/aws-apigatewayv2";
import {LambdaWebSocketIntegration} from "@aws-cdk/aws-apigatewayv2-integrations";
import {NodejsFunction} from "@aws-cdk/aws-lambda-nodejs";
import {AttributeType, Table} from "@aws-cdk/aws-dynamodb";
import {PolicyStatement} from "@aws-cdk/aws-iam";

export class AudioCompressionCdkStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const PARTITION_KEY = 'connectionId';

        const table = new Table(this, 'WebsocketConnections', {
            partitionKey: { name: PARTITION_KEY, type: AttributeType.STRING },
        });

        const connectHandler = new NodejsFunction(this, 'ConnectHandler', {
            entry: 'lambdas/connect.ts',
            environment: {
                TABLE_NAME: table.tableName,
                PARTITION_KEY
            },
        });

        const disconnectHandler = new NodejsFunction(this, 'DisconnectHandler', {
            entry: 'lambdas/disconnect.ts',
            environment: {
                TABLE_NAME: table.tableName,
                PARTITION_KEY
            },
        });

        const messageHandler = new NodejsFunction(this, 'MessageHandler', {
            entry: 'lambdas/message.ts',
            environment: {
                TABLE_NAME: table.tableName,
                PARTITION_KEY
            },
        });

        const webSocketApi = new WebSocketApi(this, 'MessageWebsocketApi', {
            connectRouteOptions: {integration: new LambdaWebSocketIntegration({handler: connectHandler})},
            disconnectRouteOptions: {integration: new LambdaWebSocketIntegration({handler: disconnectHandler})},
        });

        const apiStage = new WebSocketStage(this, 'Dev', {
            webSocketApi,
            stageName: 'dev',
            autoDeploy: true,
        });

        webSocketApi.addRoute('message', {
            integration: new LambdaWebSocketIntegration({
                handler: messageHandler,
            }),
        });

        const connectionsArns = this.formatArn({
            service: 'execute-api',
            resourceName: `${apiStage.stageName}/POST/*`,
            resource: webSocketApi.apiId,
        });

        messageHandler.addToRolePolicy(
            new PolicyStatement({
                actions: ['execute-api:ManageConnections'],
                resources: [connectionsArns]
            })
        );

        table.grantReadWriteData(connectHandler);
        table.grantReadWriteData(disconnectHandler);
        table.grantReadWriteData(messageHandler);
    }
}
