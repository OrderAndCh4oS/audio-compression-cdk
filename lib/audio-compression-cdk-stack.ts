import * as cdk from '@aws-cdk/core';
import {Duration} from '@aws-cdk/core';
import {WebSocketApi, WebSocketStage} from "@aws-cdk/aws-apigatewayv2";
import {LambdaWebSocketIntegration} from "@aws-cdk/aws-apigatewayv2-integrations";
import {NodejsFunction} from "@aws-cdk/aws-lambda-nodejs";
import {Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal} from "@aws-cdk/aws-iam";
import {Bucket, CfnBucket, HttpMethods} from "@aws-cdk/aws-s3";
import {Cors, LambdaIntegration, RestApi} from "@aws-cdk/aws-apigateway";
import * as events from '@aws-cdk/aws-events';
import * as events_targets from '@aws-cdk/aws-events-targets';

export class AudioCompressionCdkStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        const STAGE = 'dev'; // Todo: replace with environment variable
        const DOMAIN_NAME = 'http://localhost:3000'; // Todo: replace with environment variable
        // Note: Get your MEDIA_CONVERT_ENDPOINT here: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/emc-examples-getendpoint.html
        const MEDIA_CONVERT_ENDPOINT = 'https://r1eeew44a.mediaconvert.eu-west-1.amazonaws.com'; // Todo: replace with environment variable
        const BUCKET_NAME = 'audio-compression'; // Todo: replace with environment variable

        const mediaConvertPolicyStatement = new PolicyDocument({
            statements: [
                new PolicyStatement({
                    actions: [
                        "mediaconvert:*",
                        "s3:ListAllMyBuckets",
                        "s3:ListBucket",
                        "s3:PutObject",
                        "s3:PutObjectAcl",
                        "s3:GetObject"
                    ],
                    resources: ['*'],
                    effect: Effect.ALLOW,
                }),
                new PolicyStatement({
                    actions: [
                        "iam:PassRole"
                    ],
                    resources: ['*'],
                    conditions: {
                        StringLike: {
                            "iam:PassedToService": [
                                "mediaconvert.amazonaws.com"
                            ]
                        }
                    },
                    effect: Effect.ALLOW,
                }),
            ],
        });

        const role = new Role(this, 'mediaconvert-iam-role', {
            assumedBy: new ServicePrincipal('mediaconvert.amazonaws.com'),
            description: 'MediaConvert IAM role in AWS CDK',
            inlinePolicies: {
                MediaConvert: mediaConvertPolicyStatement,
            },
        });

        const connectHandler = new NodejsFunction(this, 'AudioCompressionConnect', {
            entry: 'lambdas/websocket/connect.ts',
        });

        const disconnectHandler = new NodejsFunction(this, 'AudioCompressionDisconnect', {
            entry: 'lambdas/websocket/disconnect.ts',
        });

        const audioCompressionHandler = new NodejsFunction(this, 'AudioCompressionHandler', {
            entry: 'lambdas/websocket/audio-compression.ts',
            timeout: Duration.minutes(2),
            environment: {
                MEDIA_CONVERT_ROLE: role.roleArn,
                MEDIA_CONVERT_ENDPOINT,
                BUCKET_NAME,
            }
        });

        audioCompressionHandler.addToRolePolicy(new PolicyStatement({
            actions: [
                "iam:PassRole",
                "mediaconvert:*",
                "s3:ListAllMyBuckets",
                "s3:ListBucket",
            ],
            resources: ['*'],
            effect: Effect.ALLOW,
        }))

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

        const bucket = new Bucket(this, 'AudioCompressionBucket', {
            bucketName: BUCKET_NAME,
            cors: [
                {
                    allowedMethods: [
                        HttpMethods.GET,
                        HttpMethods.POST,
                        HttpMethods.PUT,
                    ],
                    allowedOrigins: [DOMAIN_NAME],
                    allowedHeaders: ['*'],
                    maxAge: 3000,
                },
            ],
        });

        const cfnBucket = bucket.node.defaultChild as CfnBucket
        cfnBucket.accelerateConfiguration = {
            accelerationStatus: 'Enabled',
        }

        const getPreSignedUrl = new NodejsFunction(this, 'GetPreSignedUrl', {
            entry: 'lambdas/handlers/get-presigned-url.ts',
            environment: {
                BUCKET_NAME: cfnBucket.bucketName!
            }
        });

        bucket.grantPut(getPreSignedUrl);
        bucket.grantPutAcl(getPreSignedUrl);

        api.root
            .addResource('presigned-url')
            .addMethod('GET', new LambdaIntegration(getPreSignedUrl));

        const mediaConvertEventsHandler = new NodejsFunction(this, 'MediaConvertEventsHandler', {
            entry: 'lambdas/handlers/media-convert-events.ts',
            environment: {
                STAGE,
                WEBSOCKET_API_ENDPOINT: webSocketApi.apiEndpoint,
            }
        });

        mediaConvertEventsHandler.addToRolePolicy(new PolicyStatement({
            actions: [
                'execute-api:ManageConnections',
            ],
            resources: ['*'],
            effect: Effect.ALLOW,
        }))

        const mediaConvertRule = new events.Rule(this, 'MediaConvertEventsRule', {
            description: 'mediaconvert events are caught here',
            eventPattern: {
                source: ["aws.mediaconvert"],
                detailType: ["MediaConvert Job State Change"]
            }
        });

        mediaConvertRule.addTarget(new events_targets.LambdaFunction(mediaConvertEventsHandler));
    }
}
