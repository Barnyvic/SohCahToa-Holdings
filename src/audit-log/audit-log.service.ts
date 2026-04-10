import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction } from './audit-actions.enum';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async create(
    action: AuditAction,
    actorUserId: string | null,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditLogRepository.save(
      this.auditLogRepository.create({ action, actorUserId, metadata }),
    );
  }
}
