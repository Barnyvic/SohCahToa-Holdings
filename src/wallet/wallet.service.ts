import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Wallet } from './wallet.entity';
import { WalletRepository } from './wallet.repository';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly walletRepository: WalletRepository) {}

  async getWalletForRequester(
    user: JwtPayload,
    requestedUserId?: string,
  ): Promise<Wallet> {
    const isAdmin = String(user.role) === 'admin';
    const scopedUserId =
      isAdmin && requestedUserId ? requestedUserId : user.sub;
    if (requestedUserId && !isAdmin && requestedUserId !== user.sub) {
      this.logger.warn(
        `Wallet access denied requester=${user.sub} target=${requestedUserId}`,
      );
      throw new ForbiddenException('Cannot access another user wallet');
    }
    const wallet =
      await this.walletRepository.findByUserIdWithUser(scopedUserId);
    if (!wallet) {
      this.logger.warn(`Wallet not found userId=${scopedUserId}`);
      throw new NotFoundException('Wallet not found');
    }
    this.logger.log(`Wallet fetched userId=${scopedUserId}`);
    return wallet;
  }
}
