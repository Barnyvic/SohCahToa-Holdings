import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditAction } from '../audit-log/audit-actions.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { DistributedLockService } from '../locks/distributed-lock.service';
import { MoneyService } from '../utils/money/money.service';
import { Wallet } from '../wallet/wallet.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionStatus } from './enums/transaction-status.enum';
import { TransactionType } from './enums/transaction-type.enum';
import { TransactionsRepository } from './transactions.repository';
import { WalletTransaction } from './transaction.entity';
import type {
  AuditAfterCommitPayload,
  PaginatedWalletTransactions,
} from './types/transactions-service.types';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly transactionsRepository: TransactionsRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly moneyService: MoneyService,
    private readonly distributedLockService: DistributedLockService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async listForUser(
    user: JwtPayload,
    page: number,
    limit: number,
  ): Promise<PaginatedWalletTransactions> {
    const { data, total }: { data: WalletTransaction[]; total: number } =
      await this.transactionsRepository.listForUser(user.sub, page, limit);
    const result: PaginatedWalletTransactions = { data, total, page, limit };
    return result;
  }

  async create(
    dto: CreateTransactionDto,
    user: JwtPayload,
  ): Promise<WalletTransaction> {
    const walletRow: Pick<Wallet, 'id'> | null = await this.dataSource
      .getRepository(Wallet)
      .findOne({
        where: { userId: user.sub },
        select: { id: true },
      });
    const walletId = walletRow?.id ?? null;
    if (!walletId) throw new NotFoundException('Wallet not found');

    const lockKey = `wallet-lock:${walletId}`;
    const lockValue = await this.distributedLockService.acquire(lockKey);
    const queryRunner = this.dataSource.createQueryRunner();
    let audit: AuditAfterCommitPayload | null = null;

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      const manager = queryRunner.manager;

      const existing =
        await this.transactionsRepository.findByIdempotencyKeyWithManager(
          manager,
          dto.idempotencyKey,
        );
      if (existing) {
        audit = {
          action: AuditAction.TRANSACTION_DUPLICATE,
          actorUserId: user.sub,
          metadata: {
            transactionId: existing.id,
            walletId: existing.walletId,
            idempotencyKey: dto.idempotencyKey,
          },
        };
        await queryRunner.commitTransaction();
        this.auditAfterCommit(audit);
        return existing;
      }

      const wallet = await manager
        .createQueryBuilder(Wallet, 'wallet')
        .where('wallet.id = :walletId AND wallet.user_id = :userId', {
          walletId,
          userId: user.sub,
        })
        .setLock('pessimistic_write')
        .getOne();

      if (!wallet) throw new NotFoundException('Wallet not found');

      const amount = this.moneyService.normalizeAmount(dto.amount);
      const balanceBefore = wallet.balance;

      if (
        dto.type === TransactionType.DEBIT &&
        !this.moneyService.gte(wallet.balance, amount)
      ) {
        const failed = manager.create(WalletTransaction, {
          walletId: wallet.id,
          type: dto.type,
          amount,
          balanceBefore,
          balanceAfter: balanceBefore,
          reference: this.generateReference(),
          status: TransactionStatus.FAILED,
          idempotencyKey: dto.idempotencyKey,
        });
        const failedTx = await manager.save(WalletTransaction, failed);
        audit = {
          action: AuditAction.TRANSACTION_DEBIT_FAILED,
          actorUserId: user.sub,
          metadata: {
            transactionId: failedTx.id,
            walletId: wallet.id,
            idempotencyKey: dto.idempotencyKey,
          },
        };
        await queryRunner.commitTransaction();
        this.auditAfterCommit(audit);
        return failedTx;
      }

      const newBalance =
        dto.type === TransactionType.CREDIT
          ? this.moneyService.add(balanceBefore, amount)
          : this.moneyService.subtract(balanceBefore, amount);

      const transaction = manager.create(WalletTransaction, {
        walletId: wallet.id,
        type: dto.type,
        amount,
        balanceBefore,
        balanceAfter: newBalance,
        reference: this.generateReference(),
        status: TransactionStatus.PENDING,
        idempotencyKey: dto.idempotencyKey,
      });

      const savedTx = await manager.save(WalletTransaction, transaction);

      wallet.balance = newBalance;

      await manager.save(Wallet, wallet);
      savedTx.status = TransactionStatus.SUCCESS;
      await manager.save(WalletTransaction, savedTx);

      audit = {
        action:
          dto.type === TransactionType.CREDIT
            ? AuditAction.TRANSACTION_CREDIT_SUCCESS
            : AuditAction.TRANSACTION_DEBIT_SUCCESS,
        actorUserId: user.sub,
        metadata: {
          transactionId: savedTx.id,
          walletId: wallet.id,
          idempotencyKey: dto.idempotencyKey,
        },
      };

      await queryRunner.commitTransaction();
      this.auditAfterCommit(audit);
      return savedTx;
    } catch (error: unknown) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      if (this.isDuplicateIdempotencyError(error)) {
        const existing = await this.transactionsRepository.findByIdempotencyKey(
          dto.idempotencyKey,
        );
        if (existing) {
          this.auditAfterCommit({
            action: AuditAction.TRANSACTION_DUPLICATE,
            actorUserId: user.sub,
            metadata: {
              transactionId: existing.id,
              walletId: existing.walletId,
              idempotencyKey: dto.idempotencyKey,
            },
          });
          return existing;
        }
      }
      throw error;
    } finally {
      if (!queryRunner.isReleased) {
        await queryRunner.release();
      }
      await this.distributedLockService.release(lockKey, lockValue);
    }
  }

  private generateReference(): string {
    return `TXN-${randomUUID()}`;
  }

  private isDuplicateIdempotencyError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const errorWithCode = error as { code?: string; message?: string };
    return (
      errorWithCode.code === 'ER_DUP_ENTRY' &&
      (errorWithCode.message?.includes('idempotency_key') ?? false)
    );
  }

  private auditAfterCommit(audit: AuditAfterCommitPayload | null): void {
    if (!audit) return;
    this.auditLogService
      .create(audit.action, audit.actorUserId, audit.metadata)
      .catch((err: unknown) => {
        this.logger.error(`Audit log failed: ${this.formatError(err)}`);
      });
  }

  private formatError(err: unknown): string {
    if (err instanceof Error) {
      return `${err.name}: ${err.message}`;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
}
