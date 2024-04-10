import { TransactionRequest } from '@ethersproject/abstract-provider';
import { getAddress } from '@ethersproject/address';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Address } from 'wagmi';

import { analytics } from '~/analytics';
import { event } from '~/analytics/event';
import config from '~/core/firebase/remoteConfig';
import { i18n } from '~/core/languages';
import { NATIVE_ASSETS_PER_CHAIN } from '~/core/references';
import { useDappMetadata } from '~/core/resources/metadata/dapp';
import { useFlashbotsEnabledStore, useGasStore } from '~/core/state';
import { useConnectedToHardhatStore } from '~/core/state/currentSettings/connectedToHardhat';
import { useFeatureFlagsStore } from '~/core/state/currentSettings/featureFlags';
import { ProviderRequestPayload } from '~/core/transports/providerRequestTransport';
import { ChainId } from '~/core/types/chains';
import { NewTransaction, TxHash } from '~/core/types/transactions';
import { chainIdToUse } from '~/core/utils/chains';
import { POPUP_DIMENSIONS } from '~/core/utils/dimensions';
import { addNewTransaction } from '~/core/utils/transactions';
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
}: ApproveRequestProps) {
  const [waitingForDevice, setWaitingForDevice] = useState(false);
  const [loading, setLoading] = useState(false);
  const { data: dappMetadata } = useDappMetadata({
    url: request?.meta?.sender?.url,
  });
  const { activeSession } = useAppSession({ host: dappMetadata?.appHost });
  const { selectedGas } = useGasStore();
  const selectedWallet = activeSession?.address || '';
  const { connectedToHardhat, connectedToHardhatOp } =
    useConnectedToHardhatStore();
  const { asset, selectAssetAddressAndChain } = useSendAsset();
  const { watchedWallets } = useWallets();
  const { featureFlags } = useFeatureFlagsStore();

  const { flashbotsEnabled } = useFlashbotsEnabledStore();
  const flashbotsEnabledGlobally =
    config.flashbots_enabled &&
    flashbotsEnabled &&
    activeSession?.chainId === ChainId.mainnet;

  const transactionRequests = useMemo(() => {
    const txRequest = request?.params?.[0] as TransactionRequest;
    return JSON.parse(txRequest.data as string) as TransactionRequest[];
  }, [request]);

  // const tx = useMemo(() => {
  //   return request?.params?.[0] as TransactionRequest;
  // }, [request]);

  const submittingStates = {} as { [s: number]: string };
  transactionRequests.forEach((_, index) => {
    submittingStates[index] = 'initial';
  });

  const [transactionStates, setTransactionStates] = useState(submittingStates);

  const onAcceptRequest = useCallback(async () => {
    if (!config.tx_requests_enabled) return;
    if (!selectedWallet || !activeSession) return;
    setLoading(true);

    const submittingStates = {} as { [s: number]: string };
    transactionRequests.forEach((_, index) => {
      submittingStates[index] = 'submitting';
    });
    setTransactionStates(submittingStates);

    // TODO: update this to make sure we wait for the transactions going to the same chain
    // so that we get the correct nonce
    const promises = transactionRequests.map(async (txRequest, index) => {
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
        };
        const result = await wallet.sendTransaction(txData);
        if (result) {
          const transaction = {
            asset: asset || undefined,
            value: result.value.toString(),
            data: result.data,
            flashbots: flashbotsEnabledGlobally,
            from: txData.from,
            to: txData.to,
            hash: result.hash as TxHash,
            chainId: txData.chainId,
            nonce: result.nonce,
            status: 'pending',
            type: 'send',
            ...selectedGas.transactionGasParams,
          } satisfies NewTransaction;

          setTransactionStates({ ...transactionStates, [index]: 'successful' });

          addNewTransaction({
            address: txData.from as Address,
            chainId: txData.chainId as ChainId,
            transaction,
          });
          approveRequest(result.hash);
          setWaitingForDevice(false);

          analytics.track(event.dappPromptSendTransactionApproved, {
            chainId: txData.chainId,
            dappURL: dappMetadata?.appHost || '',
            dappName: dappMetadata?.appName,
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        setTransactionStates({ ...transactionStates, [index]: 'failed' });
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

    await Promise.all(promises).finally(() => {
      setWaitingForDevice(false);
      setLoading(false);
    });
  }, [
    selectedWallet,
    activeSession,
    asset,
    flashbotsEnabledGlobally,
    selectedGas.transactionGasParams,
    approveRequest,
    dappMetadata?.appHost,
    dappMetadata?.appName,
    transactionRequests,
    setTransactionStates,
    transactionStates,
  ]);

  const onRejectRequest = useCallback(() => {
    rejectRequest();
    if (activeSession) {
      analytics.track(event.dappPromptSendTransactionRejected, {
        chainId: activeSession?.chainId,
        dappURL: dappMetadata?.appHost || '',
        dappName: dappMetadata?.appName,
      });
    }
  }, [
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
    selectAssetAddressAndChain,
    connectedToHardhatOp,
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
        transactionStates={transactionStates}
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
          loading={loading}
          dappStatus={dappMetadata?.status}
        />
      </Stack>
    </Box>
  );
}
