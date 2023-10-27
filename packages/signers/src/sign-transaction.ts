import { CompilableTransaction, ITransactionWithSignatures, TransactionVersion } from '@solana/transactions';

import { getSignersFromTransaction, IInstructionWithSigners } from './account-signer-meta';
import { TransactionSenderSigner } from './transaction-sender-signer';
import { isTransactionSigner, TransactionSigner } from './transaction-signer';

/**
 * Signs a transaction using any signers that may be stored in IAccountSignerMeta instruction accounts.
 * It will only sign TransactionSigner and ignore TransactionSenderSigner since this function does not
 * send the transaction.
 */
export async function signTransactionWithSigners<
    TSigner extends TransactionSigner | TransactionSenderSigner = TransactionSigner | TransactionSenderSigner,
    TInstruction extends IInstructionWithSigners<string, TSigner> = IInstructionWithSigners<string, TSigner>,
    TTransaction extends CompilableTransaction<TransactionVersion, TInstruction> &
        Partial<ITransactionWithSignatures> = CompilableTransaction<TransactionVersion, TInstruction> &
        Partial<ITransactionWithSignatures>
>(transaction: TTransaction): Promise<TTransaction & ITransactionWithSignatures> {
    const signers = getSignersFromTransaction(transaction).filter(isTransactionSigner);
    const signedTransactions = await Promise.all(signers.map(signer => signer.signTransaction([transaction])));
    const signatures = signedTransactions.reduce((signatures, [tx]) => {
        return { ...signatures, ...tx.signatures };
    }, transaction.signatures ?? {});
    return { ...transaction, signatures };
}
