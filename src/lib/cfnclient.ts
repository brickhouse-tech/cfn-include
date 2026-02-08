import { CloudFormationClient, ValidateTemplateCommand } from '@aws-sdk/client-cloudformation';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { addProxyToClient } from 'aws-sdk-v3-proxy';

import path from 'node:path';
import crypto from 'node:crypto';

const S3 = (opts = {}) => addProxyToClient(new S3Client(opts));
const CloudFormation = (opts = {}) => addProxyToClient(new CloudFormationClient(opts));

export interface ClientOptions {
  region?: string;
  bucket?: string;
  prefix?: string;
}

export default class Client {
  private client: CloudFormationClient;
  private s3: S3Client;
  private bucket?: string;
  private prefix: string;
  private region: string;

  constructor({ region = 'us-east-1', bucket, prefix = '' }: ClientOptions) {
    this.client = CloudFormation({ region });
    this.s3 = S3();
    this.bucket = bucket;
    this.prefix = prefix;
    this.region = region;
  }

  digest(input: string): string {
    const hash = crypto.createHash('md5');
    hash.update(input);
    return hash.digest('hex');
  }

  async uploadTemplate<T>(tpl: string, callback: (key: string) => Promise<T>): Promise<T> {
    const key = path.posix.join(this.prefix, `${this.digest(tpl)}.json`);
    await (this.s3 as S3Client & { Send: typeof S3Client.prototype.send }).Send(
      new PutObjectCommand({
        Body: tpl,
        Bucket: this.bucket,
        Key: key,
      }),
    );

    let res: T | undefined;
    let err: Error | undefined;
    try {
      res = await callback(key);
    } catch (e) {
      err = e as Error;
    }
    await this.s3
      .send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      )
      .catch(() => {});
    if (err) throw err;
    return res!;
  }

  async validateTemplate(tpl = ''): Promise<unknown> {
    const needsUpload = tpl.length > 51200;
    if (needsUpload && !this.bucket) {
      throw new Error('Cannot validate template larger than 50k without a bucket. Please provide a bucket name.');
    }
    if (needsUpload && tpl.length > 460800) {
      throw new Error('Template exceeds maximum size of 450k');
    }
    if (needsUpload) {
      return this.uploadTemplate(tpl, (key) =>
        (
          this.client.send(
            new ValidateTemplateCommand({
              TemplateURL: `https://s3.${this.region}.amazonaws.com/${this.bucket}/${key}`,
            }),
          ) as Promise<unknown> & { promise(): Promise<unknown> }
        ).promise(),
      );
    }

    return this.client.send(
      new ValidateTemplateCommand({
        TemplateBody: tpl,
      }),
    );
  }
}
