import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppDataSource } from './database/typeorm.config';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AuditLog } from './audit-log/audit-log.entity';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health.controller';
import { WalletTransaction } from './transactions/transaction.entity';
import { TransactionsModule } from './transactions/transactions.module';
import { User } from './users/user.entity';
import { UsersModule } from './users/users.module';
import { Wallet } from './wallet/wallet.entity';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
    TypeOrmModule.forRoot({
      ...AppDataSource.options,
      entities: [User, Wallet, WalletTransaction, AuditLog],
      autoLoadEntities: true,
    }),
    AuthModule,
    UsersModule,
    WalletModule,
    TransactionsModule,
    AuditLogModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
