import { WalletTransaction } from '../transaction.entity';

export type TransactionResponse = {
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
