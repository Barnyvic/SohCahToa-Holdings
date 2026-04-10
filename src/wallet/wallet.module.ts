import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../common/guards/roles.guard';
import { WalletController } from './wallet.controller';
import { Wallet } from './wallet.entity';
import { WalletRepository } from './wallet.repository';
import { WalletService } from './wallet.service';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet])],
  providers: [WalletRepository, WalletService, RolesGuard],
  controllers: [WalletController],
  exports: [WalletRepository, WalletService],
})
export class WalletModule {}
