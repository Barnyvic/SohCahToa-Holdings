import { ApiProperty } from '@nestjs/swagger';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { TransactionType } from '../enums/transaction-type.enum';

export class TransactionResponseDto {
  @ApiProperty({ example: '6d58dd95-0a9f-4f4e-b0c7-ec5cedf9a7ae' })
  id!: string;

  @ApiProperty({ example: 'TXN-7f6f03ef-4e53-496a-b25c-0d0f4624f018' })
  reference!: string;

  @ApiProperty({ example: '2e93cf03-6ca7-450b-bf7f-9c044f42f914' })
  walletId!: string;

  @ApiProperty({ enum: TransactionType, example: TransactionType.DEBIT })
  type!: TransactionType;

  @ApiProperty({ example: '100.00' })
  amount!: string;

  @ApiProperty({ example: '150.00' })
  balanceBefore!: string;

  @ApiProperty({ example: '50.00' })
  balanceAfter!: string;

  @ApiProperty({ enum: TransactionStatus, example: TransactionStatus.SUCCESS })
  status!: TransactionStatus;

  @ApiProperty({ example: 'order-12345-debit' })
  idempotencyKey!: string;

  @ApiProperty({ example: '2026-04-10T08:00:00.000Z' })
  createdAt!: Date;
}
