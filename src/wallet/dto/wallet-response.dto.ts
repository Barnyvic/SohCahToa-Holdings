import { ApiProperty } from '@nestjs/swagger';

export class WalletResponseDto {
  @ApiProperty({ example: 'Jane Doe' })
  fullName!: string;

  @ApiProperty({ example: '1500.00' })
  balance!: string;

  @ApiProperty({ example: 'NGN' })
  currency!: string;
}
