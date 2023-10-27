import { AccountRole, IAccountLookupMeta, IAccountMeta, IInstruction } from '@solana/instructions';
import { BaseTransaction, TransactionVersion } from '@solana/transactions';

import { deduplicateSigners } from './deduplicate-signers';
import { TransactionSenderSigner } from './transaction-sender-signer';
import { TransactionSigner } from './transaction-signer';

/** An extension of the IAccountMeta type that keeps track of its transaction signer. */
export interface IAccountSignerMeta<
    TAddress extends string = string,
    TSigner extends TransactionSigner | TransactionSenderSigner = TransactionSigner | TransactionSenderSigner
> extends IAccountMeta<TAddress> {
    role: AccountRole.READONLY_SIGNER | AccountRole.WRITABLE_SIGNER;
    signer: TSigner;
}

/** A variation of the IInstruction type that allows IAccountSignerMeta in its accounts array. */
export type IInstructionWithSigners<
    TProgramAddress extends string = string,
    TSigner extends TransactionSigner | TransactionSenderSigner = TransactionSigner | TransactionSenderSigner,
    TAccounts extends readonly (IAccountMeta | IAccountLookupMeta | IAccountSignerMeta<string, TSigner>)[] = readonly (
        | IAccountMeta
        | IAccountLookupMeta
        | IAccountSignerMeta<string, TSigner>
    )[]
> = IInstruction<TProgramAddress, TAccounts>;

/** Extract all signers from an instruction that may contain IAccountSignerMeta accounts. */
export function getSignersFromInstruction<
    TSigner extends TransactionSigner | TransactionSenderSigner = TransactionSigner | TransactionSenderSigner
>(instruction: IInstructionWithSigners<string, TSigner>): TSigner[] {
    return deduplicateSigners(
        (instruction.accounts ?? []).flatMap(account => ('signer' in account ? account.signer : []))
    );
}

/** Extract all signers from a transaction that may contain IAccountSignerMeta accounts. */
export function getSignersFromTransaction<
    TSigner extends TransactionSigner | TransactionSenderSigner = TransactionSigner | TransactionSenderSigner,
    TInstruction extends IInstructionWithSigners<string, TSigner> = IInstructionWithSigners<string, TSigner>
>(transaction: BaseTransaction<TransactionVersion, TInstruction>): TSigner[] {
    return deduplicateSigners(transaction.instructions.flatMap(getSignersFromInstruction));
}
