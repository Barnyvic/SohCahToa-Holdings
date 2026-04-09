import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { DistributedLockService } from '../locks/distributed-lock.service';
import { MoneyService } from '../utils/money/money.service';
import { Wallet } from '../wallet/wallet.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionStatus } from './enums/transaction-status.enum';
import { TransactionType } from './enums/transaction-type.enum';
import { WalletTransaction } from './transaction.entity';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(WalletTransaction)
    private readonly transactionRepository: Repository<WalletTransaction>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly moneyService: MoneyService,
    private readonly distributedLockService: DistributedLockService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async listForUser(
    user: JwtPayload,
    page: number,
    limit: number,
  ): Promise<WalletTransaction[]> {
    return this.transactionRepository
      .createQueryBuilder('transaction')
      .innerJoin('transaction.wallet', 'wallet')
      .where('wallet.user_id = :userId', { userId: user.sub })
      .orderBy('transaction.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();
  }

  async create(
    dto: CreateTransactionDto,
    user: JwtPayload,
  ): Promise<WalletTransaction> {
    const lockKey = `wallet-lock:${user.sub}`;
    const lockValue = await this.distributedLockService.acquire(lockKey);
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      const manager = queryRunner.manager;

      const existing = await manager.findOne(WalletTransaction, {
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        await queryRunner.commitTransaction();
        return existing;
      }

      const wallet = await manager
        .createQueryBuilder(Wallet, 'wallet')
        .where('wallet.user_id = :userId', { userId: user.sub })
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
        await queryRunner.commitTransaction();
        return failedTx;
      }

      const transaction = manager.create(WalletTransaction, {
        walletId: wallet.id,
        type: dto.type,
        amount,
        balanceBefore,
        balanceAfter:
          dto.type === TransactionType.CREDIT
            ? this.moneyService.add(balanceBefore, amount)
            : this.moneyService.subtract(balanceBefore, amount),
        reference: this.generateReference(),
        status: TransactionStatus.PENDING,
        idempotencyKey: dto.idempotencyKey,
      });

      const savedTx = await manager.save(WalletTransaction, transaction);

      wallet.balance =
        dto.type === TransactionType.CREDIT
          ? this.moneyService.add(wallet.balance, amount)
          : this.moneyService.subtract(wallet.balance, amount);

      if (this.moneyService.from(wallet.balance).isNegative()) {
        throw new BadRequestException('Wallet balance cannot be negative');
      }

      await manager.save(Wallet, wallet);
      savedTx.status = TransactionStatus.SUCCESS;
      await manager.save(WalletTransaction, savedTx);

      await this.auditLogService.create('transaction.created', user.sub, {
        transactionId: savedTx.id,
        walletId: wallet.id,
      });

      await queryRunner.commitTransaction();
      return savedTx;
    } catch (error: unknown) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
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
    return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
