import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);
  private readonly redisClient: Redis | null;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    this.redisClient = redisUrl ? new Redis(redisUrl) : null;
    if (!this.redisClient) {
      this.logger.warn(
        'REDIS_URL not configured; distributed lock is disabled',
      );
    }
  }

  async acquire(lockKey: string, ttlMs = 5000): Promise<string | null> {
    if (!this.redisClient) return null;
    const lockValue = `${Date.now()}-${Math.random()}`;
    const result = await this.redisClient.set(
      lockKey,
      lockValue,
      'PX',
      ttlMs,
      'NX',
    );
    const acquired = result === 'OK';
    if (acquired) {
      this.logger.debug(`Lock acquired key=${lockKey} ttlMs=${ttlMs}`);
      return lockValue;
    }
    this.logger.debug(`Lock busy key=${lockKey}`);
    return null;
  }

  async release(lockKey: string, lockValue: string | null): Promise<void> {
    if (!this.redisClient || !lockValue) return;
    const currentValue = await this.redisClient.get(lockKey);
    if (currentValue === lockValue) {
      await this.redisClient.del(lockKey);
      this.logger.debug(`Lock released key=${lockKey}`);
    }
  }
}
