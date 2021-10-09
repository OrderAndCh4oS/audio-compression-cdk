import * as cdk from '@aws-cdk/core';
import {WebSocketApi, WebSocketStage} from "@aws-cdk/aws-apigatewayv2";
import {LambdaWebSocketIntegration} from "@aws-cdk/aws-apigatewayv2-integrations";
import {NodejsFunction} from "@aws-cdk/aws-lambda-nodejs";
import {PolicyStatement} from "@aws-cdk/aws-iam";
import {Bucket, CfnBucket} from "@aws-cdk/aws-s3";
import {Cors, LambdaIntegration, RestApi} from "@aws-cdk/aws-apigateway";

export class AudioCompressionCdkStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        const STAGE = 'dev'; // Todo: replace with environment variable

        const connectHandler = new NodejsFunction(this, 'AudioCompressionConnect', {
            entry: 'lambdas/websocket/connect.ts',
        });

        const disconnectHandler = new NodejsFunction(this, 'AudioCompressionDisconnect', {
            entry: 'lambdas/websocket/disconnect.ts',
        });

        const audioCompressionHandler = new NodejsFunction(this, 'AudioCompressionMessage', {
            entry: 'lambdas/websocket/audio-compression.ts',
        });

        const webSocketApi = new WebSocketApi(this, 'AudioCompressionWebsocket', {
            connectRouteOptions: {integration: new LambdaWebSocketIntegration({handler: connectHandler})},
            disconnectRouteOptions: {integration: new LambdaWebSocketIntegration({handler: disconnectHandler})},
        });

        const apiStage = new WebSocketStage(this, 'AudioCompressionWebsocketStage', {
            webSocketApi,
            stageName: STAGE,
            autoDeploy: true,
        });

        webSocketApi.addRoute('audio-compression', {
            integration: new LambdaWebSocketIntegration({
                handler: audioCompressionHandler,
            }),
        });

        const connectionsArns = this.formatArn({
            service: 'execute-api',
            resourceName: `${apiStage.stageName}/POST/*`,
            resource: webSocketApi.apiId,
        });

        audioCompressionHandler.addToRolePolicy(
            new PolicyStatement({
                actions: ['execute-api:ManageConnections'],
                resources: [connectionsArns]
            })
        );

        const api = new RestApi(this, `AudioCompressionApi`, {
            restApiName: 'HicEtNuncGalleryApi',
            defaultCorsPreflightOptions: {
                allowOrigins: Cors.ALL_ORIGINS,
                allowMethods: Cors.ALL_METHODS,
                allowHeaders: Cors.DEFAULT_HEADERS,
            },
            deploy: true,
            deployOptions: {
                stageName: STAGE,
                cachingEnabled: false,
            },
        });

        const getPreSignedUrl = new NodejsFunction(this, 'GetPreSignedUrl', {
            entry: 'lambdas/handlers/get-presigned-url.ts'
        });

        api.root
            .addResource('presigned-url')
            .addMethod('GET', new LambdaIntegration(getPreSignedUrl));

        const bucket = new Bucket(this, 'AudioCompressionBucket');

        const cfnBucket = bucket.node.defaultChild as CfnBucket
        cfnBucket.accelerateConfiguration = {
            accelerationStatus: 'Enabled',
        }
    }
}
