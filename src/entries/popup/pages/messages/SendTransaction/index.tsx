import { TransactionRequest } from '@ethersproject/abstract-provider';
import { getAddress } from '@ethersproject/address';
import { id } from '@ethersproject/hash';
import {
  SendTransactionResponse,
  SignedOperation,
  TransactionStatus,
  getTransactionsStatuses,
  sendTransactions,
} from '@orbykit/core';
import _ from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Address } from 'wagmi';

import { analytics } from '~/analytics';
import { event } from '~/analytics/event';
import config from '~/core/firebase/remoteConfig';
import { i18n } from '~/core/languages';
import { NATIVE_ASSETS_PER_CHAIN } from '~/core/references';
import { useDappMetadata } from '~/core/resources/metadata/dapp';
import { useFlashbotsEnabledStore, usePendingRequestStore } from '~/core/state';
import { useConnectedToHardhatStore } from '~/core/state/currentSettings/connectedToHardhat';
import { useFeatureFlagsStore } from '~/core/state/currentSettings/featureFlags';
import { ProviderRequestPayload } from '~/core/transports/providerRequestTransport';
import { ChainId } from '~/core/types/chains';
import { OnchainOperation, OperationStatus } from '~/core/types/transactions';
import { chainIdToUse } from '~/core/utils/chains';
import { POPUP_DIMENSIONS } from '~/core/utils/dimensions';
import { Bleed, Box, Separator, Stack } from '~/design-system';
import { triggerAlert } from '~/design-system/components/Alert/Alert';
import { TransactionFee } from '~/entries/popup/components/TransactionFee/TransactionFee';
import { showLedgerDisconnectedAlertIfNeeded } from '~/entries/popup/handlers/ledger';
import { useSendAsset } from '~/entries/popup/hooks/send/useSendAsset';
import { useAppSession } from '~/entries/popup/hooks/useAppSession';
import { useWallets } from '~/entries/popup/hooks/useWallets';
import { RainbowError, logger } from '~/logger';

import * as wallet from '../../../handlers/wallet';
import { AccountSigningWith } from '../AccountSigningWith';

import { SendTransactionActions } from './SendTransactionActions';
import { SendTransactionInfo } from './SendTransactionsInfo';

interface ApproveRequestProps {
  approveRequest: (payload: unknown) => void;
  rejectRequest: () => void;
  request: ProviderRequestPayload;
  transactionRequests: OnchainOperation[];
  isFormulating: boolean;
  operationsId?: string;
  transactionId?: string;
}

export interface SelectedNetwork {
  network: string;
  chainId: number;
  name: string;
}

export function SendTransaction({
  approveRequest,
  rejectRequest,
  request,
  transactionRequests,
  isFormulating,
  operationsId,
}: ApproveRequestProps) {
  const [waitingForDevice, setWaitingForDevice] = useState(false);
  const [loading, setLoading] = useState(false);
  const { data: dappMetadata } = useDappMetadata({
    url: request?.meta?.sender?.url,
  });
  const { activeSession } = useAppSession({ host: dappMetadata?.appHost });
  const { updateTransactionStatus } = usePendingRequestStore();
  // const { selectedGas } = useGasStore();
  const selectedWallet = activeSession?.address || '';
  const { connectedToHardhat, connectedToHardhatOp } =
    useConnectedToHardhatStore();
  const { selectAssetAddressAndChain } = useSendAsset();
  const { watchedWallets } = useWallets();
  const { featureFlags } = useFeatureFlagsStore();

  const { flashbotsEnabled } = useFlashbotsEnabledStore();
  const flashbotsEnabledGlobally =
    config.flashbots_enabled &&
    flashbotsEnabled &&
    activeSession?.chainId === ChainId.mainnet;

  const { removeTransactionOperations } = usePendingRequestStore();

  console.log(
    'transactionRequests',
    transactionRequests,
    isFormulating,
    operationsId,
  );

  const onAcceptRequest = useCallback(async () => {
    console.log(
      '[SendTransaction] onAcceptRequest',
      config.tx_requests_enabled,
      !selectedWallet || !activeSession,
    );
    if (!config.tx_requests_enabled) return;
    if (!selectedWallet || !activeSession) return;
    setLoading(true);

    const submittingStates: {
      status: OperationStatus;
      transactionId?: string;
    }[] = transactionRequests.map(() => {
      return { status: OperationStatus.SUBMITTING, transactionId: undefined };
    });

    console.log(
      '[SendTransaction] submittingStates',
      submittingStates,
      operationsId,
    );
    updateTransactionStatus(submittingStates, operationsId);

    // TODO: update this to make sure we wait for the transactions going to the same chain
    // so that we get the correct nonce
    const promises = transactionRequests.map(async (txRequest) => {
      try {
        const { type } = await wallet.getWallet(selectedWallet);

        // Change the label while we wait for confirmation
        if (type === 'HardwareWalletKeychain') {
          setWaitingForDevice(true);
        }

        const txData = {
          from: selectedWallet,
          to: txRequest?.to ? getAddress(txRequest?.to) : undefined,
          value: txRequest.value || '0x0',
          data: txRequest.data ?? '0x',
          chainId: txRequest.chainId!,
          gasLimit: 300_000,
        };
        const result = (await wallet.signOrSendTransaction(
          txData,
          'sign_transaction',
        )) as { signedTx: string; raw: TransactionRequest };

        return {
          raw: { ...result.raw, chainId: txRequest.chainId },
          signedTx: result.signedTx,
          type: txRequest.operation,
        } as SignedOperation;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        const submittingStates = transactionRequests.map(() => {
          return { status: OperationStatus.FAILED };
        });
        updateTransactionStatus(submittingStates, operationsId);

        showLedgerDisconnectedAlertIfNeeded(e);
        logger.error(
          new RainbowError('send: error executing send dapp approval'),
          {
            message: (e as Error)?.message,
          },
        );
        const extractedError = (e as Error).message.split('[')[0];
        triggerAlert({
          text: i18n.t('errors.sending_transaction'),
          description: extractedError,
        });
      }
    });

    console.log('[SendTransaction] promises', promises);
    const signedOperations: SignedOperation[] = await Promise.all(
      promises,
    ).then((results) => _.compact(results));

    console.log('[SendTransaction] signedOperations 1', signedOperations);

    // handle the case when there was an error signing the transaction
    if (signedOperations.length == 0) {
      setWaitingForDevice(false);
      setLoading(false);
      approveRequest(null);
      return;
    } else {
      const ids = signedOperations.map((operation) => {
        const operationId = id(operation.signedTx);
        return operationId;
      });

      console.log('[SendTransaction] signedOperations 2', signedOperations);
      // send the transactions and do not wait
      const supportingOperations = signedOperations.slice(
        0,
        signedOperations.length - 1,
      );
      console.log(
        '[SendTransaction] supportingOperations',
        supportingOperations,
      );
      const supportingOutput = await sendTransactions(supportingOperations);
      console.log('[SendTransaction] supportingOutput', supportingOutput);

      const finalOperations = signedOperations.slice(
        signedOperations.length - 1,
        signedOperations.length,
      );
      console.log('[SendTransaction] finalOperations', finalOperations);
      sendTransactions(finalOperations);
      console.log('[SendTransaction] after final ops');

      let statuses: SendTransactionResponse[] | undefined = [];
      // let fetchStatuses = true;
      const waitingTime = 6_000; // 4 seconds

      let intervalId: NodeJS.Timeout | null = null;

      intervalId = setInterval(async () => {
        console.log('[SendTransaction] intervalId', intervalId);
        statuses = await getTransactionsStatuses(ids);
        console.log('[SendTransaction] statuses', statuses);
        if (!statuses) {
          approveRequest(null);
          setWaitingForDevice(false);
          // fetchStatuses = false;
          return;
        }

        let shouldUpdate = false;

        for (let index = 0; index < statuses.length; index++) {
          const operation = transactionRequests[index];
          const status = statuses[index];
          if (
            status.status == TransactionStatus.SUCCESSFUL ||
            status.status == TransactionStatus.PENDING
          ) {
            shouldUpdate = !shouldUpdate
              ? operation.status != OperationStatus.SUCCESSFUL
              : shouldUpdate;
            submittingStates[index] = {
              status: OperationStatus.SUCCESSFUL,
              transactionId: ids[index],
            };
          } else if (status.status == TransactionStatus.FAILED) {
            // fetchStatuses = false;
            shouldUpdate = !shouldUpdate
              ? operation.status != OperationStatus.FAILED
              : shouldUpdate;
            submittingStates[index] = {
              status: OperationStatus.FAILED,
              transactionId: ids[index],
            };
          } else {
            shouldUpdate = !shouldUpdate
              ? operation.status != OperationStatus.SUBMITTING
              : shouldUpdate;
            submittingStates[index] = {
              status: OperationStatus.SUBMITTING,
              transactionId: ids[index],
            };
          }
        }

        console.log('[SendTransaction] before', submittingStates, shouldUpdate);
        if (shouldUpdate) {
          updateTransactionStatus(submittingStates, operationsId);
        }
        console.log('[SendTransaction] after', submittingStates);

        const finalTransactionStatus = statuses[statuses.length - 1];

        console.log('finalTransactionStatus', finalTransactionStatus);

        if (
          finalTransactionStatus.status == TransactionStatus.SUCCESSFUL ||
          finalTransactionStatus.status == TransactionStatus.PENDING
        ) {
          // fetchStatuses = false;
          console.log('this is finally here 1', finalTransactionStatus.hash);
          approveRequest(finalTransactionStatus.hash);
          setWaitingForDevice(false);
          removeTransactionOperations(operationsId);
          clearInterval(intervalId!);
        } else if (finalTransactionStatus.status == TransactionStatus.FAILED) {
          console.log('this is finally here 2', finalTransactionStatus);
          // fetchStatuses = false;
          approveRequest(null);
          setWaitingForDevice(false);
          removeTransactionOperations(operationsId);
          clearInterval(intervalId!);
        }
      }, waitingTime);

      console.log('[SendTransaction] submittingStates', submittingStates);
    }
  }, [
    selectedWallet,
    activeSession,
    transactionRequests,
    updateTransactionStatus,
    operationsId,
    approveRequest,
    removeTransactionOperations,
  ]);

  const onRejectRequest = useCallback(() => {
    rejectRequest();
    removeTransactionOperations(operationsId);
    if (activeSession) {
      analytics.track(event.dappPromptSendTransactionRejected, {
        chainId: activeSession?.chainId,
        dappURL: dappMetadata?.appHost || '',
        dappName: dappMetadata?.appName,
      });
    }
  }, [
    removeTransactionOperations,
    operationsId,
    rejectRequest,
    activeSession,
    dappMetadata?.appHost,
    dappMetadata?.appName,
  ]);

  const isWatchingWallet = useMemo(() => {
    const watchedAddresses = watchedWallets?.map(({ address }) => address);
    return selectedWallet && watchedAddresses?.includes(selectedWallet);
  }, [selectedWallet, watchedWallets]);

  useEffect(() => {
    if (!featureFlags.full_watching_wallets && isWatchingWallet) {
      triggerAlert({
        text: i18n.t('alert.wallet_watching_mode'),
        callback: rejectRequest,
      });
    }
  }, [featureFlags.full_watching_wallets, isWatchingWallet, rejectRequest]);

  useEffect(() => {
    if (activeSession) {
      const activeChainId = chainIdToUse(
        connectedToHardhat,
        connectedToHardhatOp,
        activeSession?.chainId,
      );
      selectAssetAddressAndChain(
        NATIVE_ASSETS_PER_CHAIN[activeChainId] as Address,
        activeChainId,
      );
    }
  }, [
    activeSession,
    connectedToHardhat,
    connectedToHardhatOp,
    selectAssetAddressAndChain,
  ]);

  return (
    <Box
      display="flex"
      flexDirection="column"
      style={{ height: POPUP_DIMENSIONS.height, overflow: 'hidden' }}
    >
      <SendTransactionInfo
        dappUrl={request?.meta?.sender?.url || ''}
        transactionRequests={transactionRequests}
        onRejectRequest={rejectRequest}
      />
      <Stack space="20px" padding="20px">
        <Bleed vertical="4px">
          <AccountSigningWith session={activeSession} />
        </Bleed>
        <Separator color="separatorTertiary" />
        <TransactionFee
          analyticsEvents={{
            customGasClicked: event.dappPromptSendTransactionCustomGasClicked,
            transactionSpeedSwitched:
              event.dappPromptSendTransactionSpeedSwitched,
            transactionSpeedClicked:
              event.dappPromptSendTransactionSpeedClicked,
          }}
          chainId={activeSession?.chainId || ChainId.mainnet}
          address={activeSession?.address}
          transactionRequest={request?.params?.[0] as TransactionRequest}
          plainTriggerBorder
          flashbotsEnabled={flashbotsEnabledGlobally}
        />
        <SendTransactionActions
          session={activeSession}
          waitingForDevice={waitingForDevice}
          onAcceptRequest={onAcceptRequest}
          onRejectRequest={onRejectRequest}
          loading={loading || isFormulating}
          dappStatus={dappMetadata?.status}
        />
      </Stack>
    </Box>
  );
}
