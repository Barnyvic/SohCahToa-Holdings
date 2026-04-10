import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Wallet } from './wallet.entity';
import { WalletRepository } from './wallet.repository';

@Injectable()
export class WalletService {
  constructor(private readonly walletRepository: WalletRepository) {}

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
    const wallet =
      await this.walletRepository.findByUserIdWithUser(scopedUserId);
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }
}
