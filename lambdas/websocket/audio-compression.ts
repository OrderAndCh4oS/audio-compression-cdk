import {ApiGatewayManagementApi, MediaConvert} from 'aws-sdk';

const MEDIA_CONVERT_ROLE = process.env.MEDIA_CONVERT_ROLE;
const MEDIA_CONVERT_ENDPOINT = process.env.MEDIA_CONVERT_ENDPOINT;
const BUCKET_NAME = process.env.BUCKET_NAME;

if (!MEDIA_CONVERT_ROLE) throw new Error('Missing MEDIA_CONVERT_ROLE');
if (!MEDIA_CONVERT_ENDPOINT) throw new Error('Missing MEDIA_CONVERT_ENDPOINT');
if (!BUCKET_NAME) throw new Error('Missing BUCKET_NAME');

const mediaConvert = new MediaConvert({
    endpoint: MEDIA_CONVERT_ENDPOINT
});

export const handler = async (event: any) => {
    if (!event.body) {
        console.log('Missing event.body')
        return {statusCode: 500, body: {error: 'Missing event.body'}};
    }

    console.log('event', JSON.stringify(event))
    console.log('body', JSON.stringify(event.body))
    const body = JSON.parse(event.body);
    const filename = body.data.filename;

    if (!filename) return {statusCode: 400, body: {error: 'Missing filename parameter'}};

    const connectionId = event.requestContext.connectionId;

    const params: MediaConvert.Types.CreateJobRequest = {
        Role: MEDIA_CONVERT_ROLE,
        UserMetadata: {
            connectionId,
        },
        Settings: {
            OutputGroups: [
                {
                    Name: 'Mp3 Group',
                    OutputGroupSettings: {
                        Type: 'FILE_GROUP_SETTINGS',
                        FileGroupSettings: {
                            Destination: `s3://${BUCKET_NAME}/out/`
                        }
                    },
                    Outputs: [
                        {
                            AudioDescriptions: [
                                {
                                    AudioTypeControl: 'FOLLOW_INPUT',
                                    CodecSettings: {
                                        Codec: 'MP3',
                                        Mp3Settings: {
                                            Bitrate: 160000,
                                            SampleRate: 48000,
                                            Channels: 2,
                                            RateControlMode: 'VBR',
                                            VbrQuality: 4
                                        }
                                    },
                                    LanguageCodeControl: 'FOLLOW_INPUT'
                                }
                            ],
                            ContainerSettings: {
                                Container: "RAW"
                            }
                        }
                    ]
                }
            ],
            AdAvailOffset: 0,
            Inputs: [
                {
                    AudioSelectors: {
                        'Audio Selector 1': {
                            Tracks: [
                                1
                            ],
                            Offset: 0,
                            DefaultSelection: 'DEFAULT',
                            SelectorType: 'TRACK',
                            ProgramSelection: 1
                        }
                    },
                    TimecodeSource: 'EMBEDDED',
                    FileInput: `s3://${BUCKET_NAME}/${filename}`
                }
            ]
        }
    }

    const result = await mediaConvert.createJob(params).promise();

    if(!result.Job?.Id) {
        return {
            statusCode: 500,
            body: {error: 'Failed to create job'}
        };
    }

    const managementApi = new ApiGatewayManagementApi({
        apiVersion: '2018-11-29',
        endpoint: event.requestContext.domainName + '/' + event.requestContext.stage,
    });

    try {
        await managementApi.postToConnection({ConnectionId: connectionId, Data: 'STARTED'}).promise();
    } catch (e: any) {
        console.log('Stack', e?.stack);
        return {
            statusCode: 500,
            body: {error: 'Failed to post to connections'}
        };
    }
    return {
        statusCode: 200,
        body: 'Done'
    };
};
