import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from './wallet.entity';

@Injectable()
export class WalletRepository {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletOrmRepository: Repository<Wallet>,
  ) {}

  findByUserIdWithUser(userId: string): Promise<Wallet | null> {
    return this.walletOrmRepository.findOne({
      where: { userId },
      relations: { user: true },
    });
  }

  async findIdByUserId(userId: string): Promise<string | null> {
    const row = await this.walletOrmRepository.findOne({
      where: { userId },
      select: { id: true },
    });
    return row?.id ?? null;
  }
}
