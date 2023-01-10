import { TransactionRequest } from '@ethersproject/abstract-provider';
import { ChainId } from '@rainbow-me/swaps';
import React, { useMemo } from 'react';
import { Address, useAccount, useBalance, useEnsName } from 'wagmi';

import { i18n } from '~/core/languages';
import { GasSpeed } from '~/core/types/gas';
import {
  RainbowTransaction,
  TransactionStatus,
  TransactionType,
} from '~/core/types/transactions';
import { truncateAddress } from '~/core/utils/address';
import { handleSignificantDecimals, toHex } from '~/core/utils/numbers';
import { updateTransaction } from '~/core/utils/transactions';
import {
  Box,
  Button,
  Inline,
  Inset,
  Row,
  Rows,
  Separator,
  Stack,
  Text,
} from '~/design-system';
import { Prompt } from '~/design-system/components/Prompt/Prompt';

import { EthSymbol } from '../../components/EthSymbol/EthSymbol';
import { TransactionFee } from '../../components/TransactionFee/TransactionFee';
import { WalletAvatar } from '../../components/WalletAvatar/WalletAvatar';
import { sendTransaction } from '../../handlers/wallet';

type SpeedUpAndCancelSheetProps = {
  cancel?: boolean;
  onClose: () => void;
  show: boolean;
  transaction?: RainbowTransaction;
};

// governs type of sheet displayed on top of MainLayout
// we should centralize this type if we add additional
// sheet modes to the main layout
export type SheetMode = 'cancel' | 'none' | 'speedUp';

export function SpeedUpAndCancelSheet({
  cancel,
  onClose,
  show,
  transaction,
}: SpeedUpAndCancelSheetProps) {
  const speedUpTransactionRequest: TransactionRequest = useMemo(
    () => ({
      to: transaction?.to,
      from: transaction?.from,
      value: transaction?.value,
      chainId: transaction?.chainId,
      data: transaction?.data,
      nonce: transaction?.nonce,
    }),
    [transaction],
  );
  const cancelTransactionRequest: TransactionRequest = useMemo(
    () => ({
      to: transaction?.from,
      from: transaction?.from,
      value: toHex('0'),
      chainId: transaction?.chainId,
      data: undefined,
      nonce: transaction?.nonce,
    }),
    [transaction],
  );
  const handleCancellation = async () => {
    const cancellationResult = await sendTransaction(cancelTransactionRequest);
    const cancelTx = {
      asset: transaction?.asset,
      data: cancellationResult?.data,
      value: cancellationResult?.value,
      from: cancellationResult?.from as Address,
      to: cancellationResult?.from as Address,
      hash: cancellationResult?.hash,
      chainId: cancelTransactionRequest?.chainId,
      status: TransactionStatus.cancelling,
      type: TransactionType.cancel,
      nonce: transaction?.nonce,
    };
    updateTransaction({
      address: cancellationResult?.from as Address,
      chainId: cancellationResult?.chainId,
      transaction: cancelTx,
    });
    onClose();
  };
  const handleSpeedUp = async () => {
    const speedUpResult = await sendTransaction(speedUpTransactionRequest);
    const speedUpTransaction = {
      asset: transaction?.asset,
      data: speedUpResult?.data,
      value: speedUpResult?.value,
      from: speedUpResult?.from as Address,
      to: speedUpResult?.to as Address,
      hash: speedUpResult?.hash,
      chainId: speedUpResult?.chainId,
      status: TransactionStatus.speeding_up,
      type: TransactionType.send,
      nonce: transaction?.nonce,
    };
    updateTransaction({
      address: speedUpResult?.from as Address,
      chainId: speedUpResult?.chainId,
      transaction: speedUpTransaction,
    });
    onClose();
  };
  return (
    <Prompt show={show} padding="12px">
      <Box
        style={{
          height: window.innerHeight - 64,
        }}
      >
        <Rows>
          <Row>
            <Box
              display="flex"
              flexDirection="column"
              justifyContent="space-between"
              height="full"
            >
              <Box
                style={{
                  margin: -12,
                  marginBottom: 0,
                  borderTopLeftRadius: 12,
                  borderTopRightRadius: 12,
                }}
                background="surfacePrimaryElevatedSecondary"
                display="flex"
                justifyContent="space-between"
                flexGrow="1"
                flexDirection="column"
              >
                <Box paddingTop="80px">
                  <Text weight="semibold" size="32pt" align="center">
                    {cancel ? '☠️' : '🚀'}
                  </Text>
                  <Box paddingTop="20px">
                    <Text
                      color="label"
                      size="20pt"
                      weight="bold"
                      align="center"
                    >
                      {i18n.t(
                        cancel
                          ? 'speed_up_and_cancel.cancel_title'
                          : 'speed_up_and_cancel.speed_up_title',
                      )}
                    </Text>
                  </Box>
                  <Box paddingTop="36px" justifyContent="center" display="flex">
                    <Box style={{ width: 236 }}>
                      <Text
                        size="14pt"
                        color="labelTertiary"
                        weight="medium"
                        align="center"
                      >
                        {i18n.t(
                          cancel
                            ? 'speed_up_and_cancel.cancel_explanation'
                            : 'speed_up_and_cancel.speed_up_explanation',
                        )}
                      </Text>
                    </Box>
                  </Box>
                </Box>
                <Box paddingHorizontal="20px" paddingVertical="16px">
                  <TransactionFee
                    chainId={transaction?.chainId || ChainId.mainnet}
                    defaultSpeed={GasSpeed.URGENT}
                    transactionRequest={
                      cancel
                        ? cancelTransactionRequest
                        : speedUpTransactionRequest
                    }
                  />
                </Box>
              </Box>
              <Box marginHorizontal="-12px">
                <Separator />
              </Box>
              <Box style={{ height: 186 }}>
                <Rows>
                  <Row>
                    <Inset horizontal="8px">
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        paddingTop="20px"
                        style={{ height: '18px' }}
                      >
                        <Stack space="12px">
                          <Text
                            weight="semibold"
                            color="labelQuaternary"
                            size="12pt"
                          >
                            {i18n.t('speed_up_and_cancel.wallet')}
                          </Text>
                          <Inline alignVertical="center" space="4px">
                            {transaction?.to && (
                              <WalletAvatar
                                address={transaction.to}
                                size={18}
                                emojiSize="12pt"
                              />
                            )}
                            <AccountName />
                          </Inline>
                        </Stack>
                        <Stack space="12px">
                          <Text
                            weight="semibold"
                            color="labelQuaternary"
                            size="12pt"
                          >
                            {i18n.t('speed_up_and_cancel.balance')}
                          </Text>
                          {transaction && (
                            <WalletBalance transaction={transaction} />
                          )}
                        </Stack>
                      </Box>
                    </Inset>
                  </Row>
                  <Row>
                    <Box paddingTop="20px">
                      <Button
                        color={cancel ? 'red' : 'blue'}
                        height="44px"
                        variant="flat"
                        width="full"
                        onClick={cancel ? handleCancellation : handleSpeedUp}
                      >
                        <Text size="16pt" weight="bold">
                          {i18n.t(
                            cancel
                              ? 'speed_up_and_cancel.cancel_cta'
                              : 'speed_up_and_cancel.speed_up_cta',
                          )}
                        </Text>
                      </Button>
                    </Box>
                  </Row>
                  <Row>
                    <Box paddingTop="10px">
                      <Button
                        color="transparent"
                        height="44px"
                        width="full"
                        variant="transparent"
                        onClick={onClose}
                      >
                        <Text size="16pt" weight="bold">
                          {i18n.t('speed_up_and_cancel.close_cta')}
                        </Text>
                      </Button>
                    </Box>
                  </Row>
                </Rows>
              </Box>
            </Box>
          </Row>
        </Rows>
      </Box>
    </Prompt>
  );
}

function AccountName() {
  const { address } = useAccount();
  const { data: ensName } = useEnsName({ address });
  return (
    <Box>
      <Text color="labelSecondary" size="14pt" weight="medium">
        {ensName ?? truncateAddress(address || '0x')}
      </Text>
    </Box>
  );
}

function WalletBalance({ transaction }: { transaction: RainbowTransaction }) {
  const { data: balance } = useBalance({
    addressOrName: transaction.from,
    chainId: transaction.chainId,
  });
  const displayBalance = handleSignificantDecimals(balance?.formatted || 0, 3);
  return (
    <Box paddingTop="2px">
      <Inline alignVertical="center" alignHorizontal="right">
        {balance?.symbol === 'ETH' && (
          <EthSymbol color="labelSecondary" size={12} />
        )}
        <Text color="labelSecondary" size="14pt" weight="medium">
          {displayBalance}
        </Text>
      </Inline>
    </Box>
  );
}