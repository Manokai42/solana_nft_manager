import {
    Connection,
    PublicKey,
    Transaction,
    TransactionInstruction,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    TransactionSignature,
    Signer,
    SendTransactionError,
    RpcResponseAndContext,
    SignatureResult
} from '@solana/web3.js';
import {
    TOKEN_PROGRAM_ID,
    createTransferInstruction,
    createBurnInstruction,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { TENSOR_PROGRAM_ID, MAX_RETRIES, RETRY_DELAY, TRANSACTION_TIMEOUT } from '../constants';
import * as log from 'electron-log';

export interface TransactionResult {
    signature: TransactionSignature;
    error?: Error;
}

export interface TransactionOptions {
    maxRetries?: number;
    retryDelay?: number;
    timeout?: number;
}

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function createTransferInstructions(
    connection: Connection,
    fromWallet: PublicKey,
    toWallet: PublicKey,
    mint: PublicKey
): Promise<TransactionInstruction[]> {
    try {
        const fromATA = await getAssociatedTokenAddress(
            mint,
            fromWallet,
            false,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );

        const toATA = await getAssociatedTokenAddress(
            mint,
            toWallet,
            false,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );

        const instructions: TransactionInstruction[] = [];

        // Check if recipient's ATA exists
        const toAccount = await connection.getAccountInfo(toATA);
        if (!toAccount) {
            instructions.push(
                createAssociatedTokenAccountInstruction(
                    fromWallet,
                    toATA,
                    toWallet,
                    mint,
                    TOKEN_PROGRAM_ID,
                    ASSOCIATED_TOKEN_PROGRAM_ID
                )
            );
        }

        // Add transfer instruction
        instructions.push(
            createTransferInstruction(
                fromATA,
                toATA,
                fromWallet,
                1, // NFTs have amount 1
                [],
                TOKEN_PROGRAM_ID
            )
        );

        return instructions;
    } catch (error) {
        log.error('Error creating transfer instructions:', error);
        throw error;
    }
}

export async function createListingInstructions(
    connection: Connection,
    wallet: PublicKey,
    mint: PublicKey,
    price: number
): Promise<TransactionInstruction[]> {
    try {
        const tokenAccount = await getAssociatedTokenAddress(
            mint,
            wallet,
            false,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );

        // Create listing instruction for Tensor marketplace
        const instructions: TransactionInstruction[] = [
            new TransactionInstruction({
                programId: new PublicKey(TENSOR_PROGRAM_ID),
                keys: [
                    { pubkey: wallet, isSigner: true, isWritable: true },
                    { pubkey: tokenAccount, isSigner: false, isWritable: true },
                    { pubkey: mint, isSigner: false, isWritable: false },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
                ],
                data: Buffer.from([/* listing instruction data */])
            })
        ];

        return instructions;
    } catch (error) {
        log.error('Error creating listing instructions:', error);
        throw error;
    }
}

export async function createDelistInstructions(
    connection: Connection,
    wallet: PublicKey,
    mint: PublicKey
): Promise<TransactionInstruction[]> {
    try {
        const tokenAccount = await getAssociatedTokenAddress(
            mint,
            wallet,
            false,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );

        const instructions: TransactionInstruction[] = [
            new TransactionInstruction({
                programId: new PublicKey(TENSOR_PROGRAM_ID),
                keys: [
                    { pubkey: wallet, isSigner: true, isWritable: true },
                    { pubkey: tokenAccount, isSigner: false, isWritable: true },
                    { pubkey: mint, isSigner: false, isWritable: false },
                ],
                data: Buffer.from([/* delisting instruction data */])
            })
        ];

        return instructions;
    } catch (error) {
        log.error('Error creating delist instructions:', error);
        throw error;
    }
}

export async function createBurnInstructions(
    connection: Connection,
    wallet: PublicKey,
    mint: PublicKey
): Promise<TransactionInstruction[]> {
    try {
        const tokenAccount = await getAssociatedTokenAddress(
            mint,
            wallet,
            false,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );

        return [
            createBurnInstruction(
                tokenAccount,
                mint,
                wallet,
                1, // NFTs have amount 1
                [],
                TOKEN_PROGRAM_ID
            )
        ];
    } catch (error) {
        log.error('Error creating burn instructions:', error);
        throw error;
    }
}

// Add WalletSigner interface
export interface WalletSigner extends Signer {
    signTransaction(transaction: Transaction): Promise<Transaction>;
    signAllTransactions(transactions: Transaction[]): Promise<Transaction[]>;
}

export async function sendAndConfirmTransaction(
    connection: Connection,
    wallet: WalletSigner,
    instructions: TransactionInstruction[],
    options: TransactionOptions = {}
): Promise<TransactionResult> {
    const {
        maxRetries = MAX_RETRIES,
        retryDelay = RETRY_DELAY,
        timeout = TRANSACTION_TIMEOUT
    } = options;

    let retries = 0;

    while (retries <= maxRetries) {
        try {
            const transaction = new Transaction().add(...instructions);
            transaction.feePayer = wallet.publicKey;
            transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

            const signed = await wallet.signTransaction(transaction);
            const signature = await connection.sendRawTransaction(signed.serialize());

            // Wait for confirmation with timeout
            const confirmation = await Promise.race([
                connection.confirmTransaction(signature) as Promise<RpcResponseAndContext<SignatureResult>>,
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Transaction confirmation timeout')), timeout)
                )
            ]);

            if ((confirmation as RpcResponseAndContext<SignatureResult>).value.err) {
                throw new Error(`Transaction failed: ${(confirmation as RpcResponseAndContext<SignatureResult>).value.err}`);
            }

            log.info('Transaction confirmed:', signature);
            return { signature };

        } catch (error) {
            if (error instanceof SendTransactionError) {
                if (retries < maxRetries) {
                    log.warn(`Transaction failed, retrying (${retries + 1}/${maxRetries}):`, error);
                    await sleep(retryDelay * Math.pow(2, retries));
                    retries++;
                    continue;
                }
            }

            log.error('Transaction failed:', error);
            return {
                signature: '',
                error: error instanceof Error ? error : new Error('Unknown error occurred')
            };
        }
    }

    const error = new Error(`Transaction failed after ${maxRetries} retries`);
    log.error(error);
    return { signature: '', error };
} 