import {ApiGatewayManagementApi, MediaConvert} from 'aws-sdk';

const MEDIA_CONVERT_ROLE = process.env.MEDIA_CONVERT_ROLE;
const BUCKET_NAME = process.env.BUCKET_NAME;

if (!MEDIA_CONVERT_ROLE) throw new Error('Missing MEDIA_CONVERT_ROLE');
if (!BUCKET_NAME) throw new Error('Missing BUCKET_NAME');

const mediaConvert = new MediaConvert();

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

    const managementApi = new ApiGatewayManagementApi({
        apiVersion: '2018-11-29',
        endpoint: event.requestContext.domainName + '/' + event.requestContext.stage,
    });

    // Todo: Handle compression here
    //       On success or failure send message back

    const params: MediaConvert.Types.CreateJobRequest = {
        Role: MEDIA_CONVERT_ROLE,
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
                    FileInput: `s3://${BUCKET_NAME}/music.mp3`
                }
            ]
        }
    }

    const result = await mediaConvert.createJob(params).promise();

    try {
        await managementApi.postToConnection({ConnectionId: connectionId, Data: result}).promise();
    } catch (e: any) {
        console.log(e.stack)
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
