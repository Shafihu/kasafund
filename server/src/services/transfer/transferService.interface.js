/**
 * Shared outbound transfer contract.
 *
 * Implementations provide:
 * - listProviders(type) -> [{ code, name }]
 * - createRecipient(input) -> { recipientCode, mode, mocked, note, raw }
 * - initiate(input) -> { status, transferCode, reference, mode, mocked, note, message, raw }
 * - verify(reference) -> the same normalized transfer result
 * - finalize(input) -> the same normalized transfer result
 *
 * Controllers import only services/transfer/index.js and never select a provider.
 */

export {};
