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
    let dataBuffer = file.buffer;
    if (file.mimetype.split('/')[0] === 'image') {
      const imageHeight = Number(file.size.toString().substring(0, 3));
      const imageWidth = Number(file.size.toString().substring(3));
      const resizeSize = this.findResizeSize(imageHeight, imageWidth);
      dataBuffer = await sharp(dataBuffer)
        .resize(resizeSize, resizeSize)
        .toBuffer();
    }
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
  private findResizeSize(height, width) {
    const sizeArr = [height, width];
    sizeArr.sort();
    const resize = sizeArr[0] > 2048 ? 2048 : sizeArr[0] > 1024 ? 1024 : 300;
    return resize;
  }
}
