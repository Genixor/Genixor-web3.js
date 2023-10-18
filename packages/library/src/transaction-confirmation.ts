import type { Commitment } from '@solana/rpc-core';
import type { GetAccountInfoApi } from '@solana/rpc-core/dist/types/rpc-methods/getAccountInfo';
import type { GetSignatureStatusesApi } from '@solana/rpc-core/dist/types/rpc-methods/getSignatureStatuses';
import type { AccountNotificationsApi } from '@solana/rpc-core/dist/types/rpc-subscriptions/account-notifications';
import type { SignatureNotificationsApi } from '@solana/rpc-core/dist/types/rpc-subscriptions/signature-notifications';
import type { SlotNotificationsApi } from '@solana/rpc-core/dist/types/rpc-subscriptions/slot-notifications';
import type { Rpc, RpcSubscriptions } from '@solana/rpc-transport/dist/types/json-rpc-types';
import {
    getSignatureFromTransaction,
    IDurableNonceTransaction,
    ITransactionWithBlockhashLifetime,
    ITransactionWithFeePayer,
    ITransactionWithSignatures,
} from '@solana/transactions';

import { createBlockHeightExceedencePromiseFactory } from './transaction-confirmation-strategy-blockheight';
import { createNonceInvalidationPromiseFactory } from './transaction-confirmation-strategy-nonce';
import { createRecentSignatureConfirmationPromiseFactory } from './transaction-confirmation-strategy-recent-signature';

interface BaseConfig {
    abortSignal: AbortSignal;
    commitment: Commitment;
    getRecentSignatureConfirmationPromise: ReturnType<typeof createRecentSignatureConfirmationPromiseFactory>;
    transaction: ITransactionWithFeePayer & ITransactionWithSignatures;
}

interface DefaultDurableNonceTransactionConfirmerConfig {
    rpc: Rpc<GetSignatureStatusesApi & GetAccountInfoApi>;
    rpcSubscriptions: RpcSubscriptions<AccountNotificationsApi & SignatureNotificationsApi>;
}

interface DefaultRecentTransactionConfirmerConfig {
    rpc: Rpc<GetSignatureStatusesApi>;
    rpcSubscriptions: RpcSubscriptions<SignatureNotificationsApi & SlotNotificationsApi>;
}

interface WaitForDurableNonceTransactionConfirmationConfig extends BaseConfig {
    getNonceInvalidationPromise: ReturnType<typeof createNonceInvalidationPromiseFactory>;
    transaction: ITransactionWithFeePayer & ITransactionWithSignatures & IDurableNonceTransaction;
}

interface WaitForRecentTransactionWithBlockhashLifetimeConfirmationConfig extends BaseConfig {
    getBlockHeightExceedencePromise: ReturnType<typeof createBlockHeightExceedencePromiseFactory>;
    transaction: ITransactionWithFeePayer & ITransactionWithSignatures & ITransactionWithBlockhashLifetime;
}

async function raceStrategies<TConfig extends BaseConfig>(
    config: TConfig,
    getSpecificStrategiesForRace: (config: TConfig) => readonly Promise<unknown>[]
) {
    const { abortSignal: callerAbortSignal, commitment, getRecentSignatureConfirmationPromise, transaction } = config;
    callerAbortSignal.throwIfAborted();
    const signature = getSignatureFromTransaction(transaction);
    const abortController = new AbortController();
    function handleAbort() {
        abortController.abort();
    }
    callerAbortSignal.addEventListener('abort', handleAbort, { signal: abortController.signal });
    try {
        const specificStrategies = getSpecificStrategiesForRace({
            ...config,
            abortSignal: abortController.signal,
        });
        return await Promise.race([
            getRecentSignatureConfirmationPromise({
                abortSignal: abortController.signal,
                commitment,
                signature,
            }),
            ...specificStrategies,
        ]);
    } finally {
        abortController.abort();
    }
}

export function createDefaultDurableNonceTransactionConfirmer({
    rpc,
    rpcSubscriptions,
}: DefaultDurableNonceTransactionConfirmerConfig) {
    const getNonceInvalidationPromise = createNonceInvalidationPromiseFactory(rpc, rpcSubscriptions);
    const getRecentSignatureConfirmationPromise = createRecentSignatureConfirmationPromiseFactory(
        rpc,
        rpcSubscriptions
    );
    return async function confirmTransaction(
        config: Omit<
            Parameters<typeof waitForDurableNonceTransactionConfirmation>[0],
            'getNonceInvalidationPromise' | 'getRecentSignatureConfirmationPromise'
        >
    ) {
        await waitForDurableNonceTransactionConfirmation({
            ...config,
            getNonceInvalidationPromise,
            getRecentSignatureConfirmationPromise,
        });
    };
}

export function createDefaultRecentTransactionConfirmer({
    rpc,
    rpcSubscriptions,
}: DefaultRecentTransactionConfirmerConfig) {
    const getBlockHeightExceedencePromise = createBlockHeightExceedencePromiseFactory(rpcSubscriptions);
    const getRecentSignatureConfirmationPromise = createRecentSignatureConfirmationPromiseFactory(
        rpc,
        rpcSubscriptions
    );
    return async function confirmRecentTransaction(
        config: Omit<
            Parameters<typeof waitForRecentTransactionConfirmation>[0],
            'getBlockHeightExceedencePromise' | 'getRecentSignatureConfirmationPromise'
        >
    ) {
        await waitForRecentTransactionConfirmation({
            ...config,
            getBlockHeightExceedencePromise,
            getRecentSignatureConfirmationPromise,
        });
    };
}

export async function waitForDurableNonceTransactionConfirmation(
    config: WaitForDurableNonceTransactionConfirmationConfig
): Promise<void> {
    await raceStrategies(
        config,
        function getSpecificStrategiesForRace({ abortSignal, commitment, getNonceInvalidationPromise, transaction }) {
            return [
                getNonceInvalidationPromise({
                    abortSignal,
                    commitment,
                    currentNonceValue: transaction.lifetimeConstraint.nonce,
                    nonceAccountAddress: transaction.instructions[0].accounts[0].address,
                }),
            ];
        }
    );
}

export async function waitForRecentTransactionConfirmation(
    config: WaitForRecentTransactionWithBlockhashLifetimeConfirmationConfig
): Promise<void> {
    await raceStrategies(
        config,
        function getSpecificStrategiesForRace({ abortSignal, getBlockHeightExceedencePromise, transaction }) {
            return [
                getBlockHeightExceedencePromise({
                    abortSignal,
                    lastValidBlockHeight: transaction.lifetimeConstraint.lastValidBlockHeight,
                }),
            ];
        }
    );
}
