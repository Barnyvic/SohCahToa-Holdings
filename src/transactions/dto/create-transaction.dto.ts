import { IsEnum, IsNumber, IsString, MaxLength, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TransactionType } from '../enums/transaction-type.enum';

export class CreateTransactionDto {
  @ApiProperty({ example: 100.0, minimum: 0.01 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiProperty({ enum: TransactionType, example: TransactionType.DEBIT })
  @IsEnum(TransactionType)
  type!: TransactionType;

  @ApiProperty({ example: 'order-12345-debit' })
  @IsString()
  @MaxLength(128)
  idempotencyKey!: string;
}
