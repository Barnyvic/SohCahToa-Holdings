import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { WalletTransaction } from './transaction.entity';

@Injectable()
export class TransactionsRepository {
  constructor(
    @InjectRepository(WalletTransaction)
    private readonly transactionOrmRepository: Repository<WalletTransaction>,
  ) {}

  async listForUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ data: WalletTransaction[]; total: number }> {
    const [data, total] = await this.transactionOrmRepository
      .createQueryBuilder('tx')
      .innerJoin('tx.wallet', 'wallet')
      .where('wallet.user_id = :userId', { userId })
      .orderBy('tx.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total };
  }

  findByIdempotencyKeyWithManager(
    manager: EntityManager,
    idempotencyKey: string,
  ): Promise<WalletTransaction | null> {
    return manager.findOne(WalletTransaction, { where: { idempotencyKey } });
  }

  findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<WalletTransaction | null> {
    return this.transactionOrmRepository.findOne({ where: { idempotencyKey } });
  }
}
