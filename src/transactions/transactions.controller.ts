import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { WalletTransaction } from './transaction.entity';
import { TransactionsService } from './transactions.service';
import type { TransactionResponse } from './types/transaction-response.type';

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
    const parsedPage = this.parsePositiveInt(page, 'page', 1);
    const parsedLimit = this.parsePositiveInt(limit, 'limit', 20, 100);

    return this.transactionsService
      .listForUser(user, parsedPage, parsedLimit)
      .then((transactions) =>
        transactions.map((transaction) =>
          this.toTransactionResponse(transaction),
        ),
      );
  }

  private parsePositiveInt(
    raw: string,
    field: 'page' | 'limit',
    fallback: number,
    max?: number,
  ): number {
    if (!raw) {
      return fallback;
    }

    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }
    if (typeof max === 'number' && value > max) {
      throw new BadRequestException(`${field} must be <= ${max}`);
    }
    return value;
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
