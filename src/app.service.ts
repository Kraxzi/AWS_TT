import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';
import { v4 as uuid } from 'uuid';
import * as sharp from 'sharp';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  async uploadPublicFile(file: Express.Multer.File, filename: string) {
    if (file.size > this.configService.get('FILE_SIZE_LIMIT')) {
      throw new Error('Too big file size');
    }
    const accessibleTypes = []; // list of accesible types, should be in constants file
    if (!accessibleTypes.includes(file.mimetype)) {
      throw new Error('Not accessible type'); // error messages should be in constats file too
    }
    const dataBuffer = file.buffer;
    if (file.mimetype.split('/')[0] === 'image') {
      const imageHeight = Number(file.size.toString().substring(0, 3));
      const imageWidth = Number(file.size.toString().substring(3));
      const resizeSizes = this.findResizeSize(imageHeight, imageWidth);
      const promiseArr = [];
      for (let i = 0; i < 3; i++) {
        promiseArr.push(
          new Promise((resolve) => {
            const newDataBuffer = sharp(dataBuffer)
              .resize(
                Math.floor(resizeSizes.heights[i]),
                Math.floor(resizeSizes.widths[i]),
              )
              .toBuffer();
            resolve(newDataBuffer);
          }).then((newDataBuffer) => {
            return new Promise((resolve) =>
              resolve(this.Uploading(newDataBuffer, filename)),
            );
          }),
        );
      }
      const result = Promise.all(promiseArr);
      return result;
    }
    return await this.Uploading(dataBuffer, filename);
  }
  private findResizeSize(height, width) {
    const neededSize = [2048, 1024, 300]; //should be in constants file
    const resized = {
      heights: [],
      widths: [],
    };
    if (height >= width) {
      resized.heights = neededSize;
      neededSize.forEach((size) =>
        resized.widths.push((size * width) / height),
      );
    } else {
      resized.widths = neededSize;
      neededSize.forEach((size) => {
        resized.heights.push((size * height) / width);
      });
    }
    return resized;
  }

  private async Uploading(dataBuffer, filename) {
    const s3 = new S3();
    const uploadResult = await s3
      .upload({
        Bucket: this.configService.get('AWS_PUBLIC_BUCKET_NAME'),
        Body: dataBuffer,
        Key: `${uuid()}-${filename}`,
      })
      .promise();
    return { key: uploadResult.Key, url: uploadResult.Location };
  }
}
