import { IsEnum, IsNumber, IsString, MaxLength, Min } from 'class-validator';
import { TransactionType } from '../enums/transaction-type.enum';

export class CreateTransactionDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsEnum(TransactionType)
  type!: TransactionType;

  @IsString()
  @MaxLength(128)
  idempotencyKey!: string;
}
