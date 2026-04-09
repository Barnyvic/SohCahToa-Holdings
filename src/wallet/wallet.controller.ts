import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { WalletService } from './wallet.service';

@Controller('wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  async getWallet(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ fullName: string; balance: string; currency: string }> {
    const wallet = await this.walletService.getWalletForRequester(user);
    return {
      fullName: wallet.user.fullName,
      balance: wallet.balance,
      currency: wallet.currency,
    };
  }

  @Roles(UserRole.ADMIN)
  @Get(':userId')
  async getWalletByUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
  ): Promise<{ fullName: string; balance: string; currency: string }> {
    const wallet = await this.walletService.getWalletForRequester(user, userId);
    return {
      fullName: wallet.user.fullName,
      balance: wallet.balance,
      currency: wallet.currency,
    };
  }
}
