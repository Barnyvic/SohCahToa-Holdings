import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';

@Injectable()
export class MoneyService {
  from(input: string | number | Decimal): Decimal {
    return new Decimal(input);
  }

  add(left: string, right: string): string {
    return this.from(left).add(this.from(right)).toFixed(2);
  }

  subtract(left: string, right: string): string {
    return this.from(left).sub(this.from(right)).toFixed(2);
  }

  gte(left: string, right: string): boolean {
    return this.from(left).gte(this.from(right));
  }

  normalizeAmount(amount: number): string {
    return this.from(amount).toFixed(2);
  }
}
