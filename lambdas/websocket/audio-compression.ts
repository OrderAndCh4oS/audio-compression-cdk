import {ApiGatewayManagementApi, MediaConvert} from 'aws-sdk';

const MEDIA_CONVERT_ROLE = process.env.MEDIA_CONVERT_ROLE;
const MEDIA_CONVERT_ENDPOINT = process.env.MEDIA_CONVERT_ENDPOINT;
const BUCKET_NAME = process.env.BUCKET_NAME;

if (!MEDIA_CONVERT_ROLE) throw new Error('Missing MEDIA_CONVERT_ROLE');
if (!MEDIA_CONVERT_ENDPOINT) throw new Error('Missing MEDIA_CONVERT_ENDPOINT');
if (!BUCKET_NAME) throw new Error('Missing BUCKET_NAME');

console.log("MEDIA_CONVERT_ROLE", MEDIA_CONVERT_ROLE);
console.log("MEDIA_CONVERT_ENDPOINT", MEDIA_CONVERT_ENDPOINT);
console.log("BUCKET_NAME", BUCKET_NAME)

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

    const managementApi = new ApiGatewayManagementApi({
        apiVersion: '2018-11-29',
        endpoint: event.requestContext.domainName + '/' + event.requestContext.stage,
    });

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

    await getJob(result.Job?.Id)();

    console.log('HERE!!!!!!!!!!');

    try {
        await managementApi.postToConnection({ConnectionId: connectionId, Data: 'Done'}).promise();
    } catch (e: any) {
        console.log('EEEEERRRRRRROOOOOOOOOOOOORRRRRRRRRRR!!!!!!!');
        console.log('Stack', e?.stack);
        return {
            statusCode: 500,
            body: {error: 'Failed to post to connections'}
        };
    }
    console.log('DOOOONNNEEEEE!!!!!!!');
    return {
        statusCode: 200,
        body: 'Done'
    };
};

const getJob = (jobId: string) => async () =>
    new Promise(async (resolve, reject) => {
        const interval = setInterval(async () => {
            const job = await mediaConvert.getJob({Id: jobId}).promise();
            console.log('Job:', job.Job);
            if(!job || !job.Job || job.Job.Status === 'ERROR') {
                console.log('ERROR!!');
                clearInterval(interval);
                reject();
                return
            }
            if(job.Job.Status === 'COMPLETE') {
                console.log('COMPLETE!!');
                clearInterval(interval);
                resolve('done');
                return
            }
        }, 200);
    })
