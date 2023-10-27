import { Base58EncodedAddress } from '@solana/addresses';

import { MessageSigner } from './message-signer';
import { TransactionSenderSigner } from './transaction-sender-signer';
import { TransactionSigner } from './transaction-signer';

/** Removes all duplicated signers from a provided array by comparing their addresses. */
export function deduplicateSigners<TSigner extends MessageSigner | TransactionSigner | TransactionSenderSigner>(
    signers: TSigner[]
): TSigner[] {
    const deduplicated: Record<Base58EncodedAddress, TSigner> = {};
    signers.forEach(signer => {
        if (!deduplicated[signer.address]) {
            deduplicated[signer.address] = signer;
        }
    });
    return Object.values(deduplicated);
}
