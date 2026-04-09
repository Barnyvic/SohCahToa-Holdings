import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { DistributedLockService } from '../locks/distributed-lock.service';
import { MoneyService } from '../utils/money/money.service';
import { Wallet } from '../wallet/wallet.entity';
import { WalletTransaction } from './transaction.entity';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WalletTransaction, Wallet]),
    AuditLogModule,
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService, MoneyService, DistributedLockService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
