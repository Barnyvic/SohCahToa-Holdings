import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Wallet } from './wallet.entity';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
  ) {}

  async getWalletForRequester(
    user: JwtPayload,
    requestedUserId?: string,
  ): Promise<Wallet> {
    const isAdmin = String(user.role) === 'admin';
    const scopedUserId =
      isAdmin && requestedUserId ? requestedUserId : user.sub;
    if (requestedUserId && !isAdmin && requestedUserId !== user.sub) {
      throw new ForbiddenException('Cannot access another user wallet');
    }
    const wallet = await this.walletRepository.findOne({
      where: { userId: scopedUserId },
      relations: { user: true },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }
}
