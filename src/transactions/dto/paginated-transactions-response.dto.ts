import { ApiProperty } from '@nestjs/swagger';
import { TransactionResponseDto } from './transaction-response.dto';

export class PaginatedTransactionsResponseDto {
  @ApiProperty({ type: () => [TransactionResponseDto] })
  data!: TransactionResponseDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;
}
