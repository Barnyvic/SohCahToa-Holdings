import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { WalletTransaction } from './transaction.entity';
import { TransactionsService } from './transactions.service';

type TransactionResponse = {
  id: string;
  reference: string;
  walletId: string;
  type: WalletTransaction['type'];
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  status: WalletTransaction['status'];
  idempotencyKey: string;
  createdAt: Date;
};

@Controller()
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get('transactions')
  getTransactions(
    @CurrentUser() user: JwtPayload,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ): Promise<TransactionResponse[]> {
    return this.transactionsService
      .listForUser(user, Number(page), Number(limit))
      .then((transactions) =>
        transactions.map((transaction) =>
          this.toTransactionResponse(transaction),
        ),
      );
  }

  private toTransactionResponse(
    transaction: WalletTransaction,
  ): TransactionResponse {
    return {
      id: transaction.id,
      reference: transaction.reference,
      walletId: transaction.walletId,
      type: transaction.type,
      amount: transaction.amount,
      balanceBefore: transaction.balanceBefore,
      balanceAfter: transaction.balanceAfter,
      status: transaction.status,
      idempotencyKey: transaction.idempotencyKey,
      createdAt: transaction.createdAt,
    };
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('transactions')
  async createTransaction(
    @Body() dto: CreateTransactionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<TransactionResponse> {
    const transaction = await this.transactionsService.create(dto, user);
    return this.toTransactionResponse(transaction);
  }
}
