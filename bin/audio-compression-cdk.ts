#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { AudioCompressionCdkStack } from '../lib/audio-compression-cdk-stack';

const app = new cdk.App();
new AudioCompressionCdkStack(app, 'AudioCompressionCdkStack');
