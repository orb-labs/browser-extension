import { OperationCallType } from '@orbykit/core';
import { AnimatePresence, motion } from 'framer-motion';
import { ReactNode, useState } from 'react';
import { Address } from 'wagmi';

import { DAppStatus } from '~/core/graphql/__generated__/metadata';
import { i18n } from '~/core/languages';
import { useUserAssets } from '~/core/resources/assets';
import { DappMetadata, useDappMetadata } from '~/core/resources/metadata/dapp';
import { useCurrentCurrencyStore, useNonceStore } from '~/core/state';
import { useTestnetModeStore } from '~/core/state/currentSettings/testnetMode';
import { useSelectedTokenStore } from '~/core/state/selectedToken';
import { ChainId } from '~/core/types/chains';
import { OnchainOperation, OperationStatus } from '~/core/types/transactions';
import {
  findRainbowChainForChainId,
  getChainName,
  isTestnetChainId,
} from '~/core/utils/chains';
import { copy, copyAddress } from '~/core/utils/copy';
import { TestnetFaucet } from '~/core/utils/faucets';
import { formatDate } from '~/core/utils/formatDate';
import { convertRawAmountToDecimalFormat } from '~/core/utils/numbers';
import { truncateString } from '~/core/utils/strings';
import { goToNewTab } from '~/core/utils/tabs';
import {
  Bleed,
  Box,
  Button,
  Inline,
  Separator,
  Stack,
  Symbol,
  Text,
} from '~/design-system';
import { SymbolName } from '~/design-system/styles/designTokens';
import { AddressDisplay } from '~/entries/popup/components/AddressDisplay';
import { ChainBadge } from '~/entries/popup/components/ChainBadge/ChainBadge';
import { DappIcon } from '~/entries/popup/components/DappIcon/DappIcon';
import { Tag } from '~/entries/popup/components/Tag';
import { triggerToast } from '~/entries/popup/components/Toast/Toast';
import { useAppSession } from '~/entries/popup/hooks/useAppSession';
import { useNativeAsset } from '~/entries/popup/hooks/useNativeAsset';
import { useRainbowNavigate } from '~/entries/popup/hooks/useRainbowNavigate';
import { ROUTES } from '~/entries/popup/urls';

import {
  DappHostName,
  MaliciousRequestWarning,
  getDappStatusBadge,
} from '../DappScanStatus';
import { SimulationOverview } from '../Simulation';
import { CopyButton, TabContent, TransactionInfoTabs } from '../Tabs';
// import { useHasEnoughGas } from '../useHasEnoughGas';
import {
  SimulationError,
  TransactionSimulation,
  useSimulateTransaction,
} from '../useSimulateTransaction';

interface SendTransactionProps {
  transactionRequests: OnchainOperation[];
  dappUrl: string;
  onRejectRequest: ({
    preventWindowClose,
  }: {
    preventWindowClose?: boolean;
  }) => void;
}

const InfoRow = ({
  symbol,
  label,
  value,
}: {
  symbol: SymbolName;
  label: ReactNode;
  value: ReactNode;
}) => (
  <Box
    display="flex"
    alignItems="center"
    justifyContent="space-between"
    gap="16px"
  >
    <Inline alignVertical="center" space="12px" wrap={false}>
      <Symbol size={14} symbol={symbol} weight="medium" color="labelTertiary" />
      <Text
        color="labelTertiary"
        size="12pt"
        weight="semibold"
        whiteSpace="nowrap"
      >
        {label}
      </Text>
    </Inline>
    <Text
      color="labelSecondary"
      size="12pt"
      weight="semibold"
      cursor="text"
      userSelect="all"
    >
      {value}
    </Text>
  </Box>
);

function Overview({
  chainId,
  simulation,
  status,
  error,
  metadata,
}: {
  chainId: ChainId;
  simulation: TransactionSimulation | undefined;
  status: 'loading' | 'error' | 'success';
  error: SimulationError | null;
  metadata: DappMetadata | null;
}) {
  const { badge, color } = getDappStatusBadge(
    metadata?.status || DAppStatus.Unverified,
    { size: 12 },
  );
  const chainName = getChainName({ chainId });

  return (
    <Stack space="16px" paddingTop="14px">
      <Text size="12pt" weight="semibold" color="labelTertiary">
        {i18n.t('simulation.title')}
      </Text>

      <SimulationOverview
        simulation={simulation}
        status={status}
        error={error}
      />

      <Separator color="separatorTertiary" />

      {chainId && chainName && (
        <InfoRow
          symbol="network"
          label={i18n.t('chain')}
          value={
            <Inline space="6px" alignVertical="center">
              <ChainBadge chainId={chainId} size={14} />
              <Text size="12pt" weight="semibold" color="labelSecondary">
                {chainName}
              </Text>
            </Inline>
          }
        />
      )}

      {metadata && (
        <InfoRow
          symbol="app.badge.checkmark"
          label="App"
          value={
            <Tag
              size="12pt"
              color={color}
              bleed
              left={badge && <Bleed vertical="3px">{badge}</Bleed>}
            >
              {metadata.appName}
            </Tag>
          }
        />
      )}
    </Stack>
  );
}

function TransactionDetails({
  simulation,
  session,
}: {
  simulation: TransactionSimulation | undefined;
  session: { address: Address; chainId: ChainId };
}) {
  const metaTo = simulation?.meta.to;

  const { getNonce } = useNonceStore();
  const { currentNonce: nonce } = getNonce(session) || {};

  const functionName = metaTo?.function.split('(')[0];
  const contract = metaTo?.address;
  const contractName = metaTo?.name;
  const isSourceCodeVerified = metaTo?.sourceCodeStatus === 'VERIFIED';
  const contractCreatedAt = metaTo?.created;

  return (
    <Box gap="16px" display="flex" flexDirection="column" paddingTop="14px">
      {!!nonce && (
        <InfoRow symbol="number" label={i18n.t('nonce')} value={nonce} />
      )}
      {functionName && (
        <InfoRow
          symbol="curlybraces"
          label={i18n.t('simulation.function')}
          value={
            <Tag size="12pt" color="labelSecondary" bleed>
              {functionName}
            </Tag>
          }
        />
      )}
      {contract && (
        <InfoRow
          symbol="doc.plaintext"
          label={i18n.t('simulation.contract')}
          value={
            <AddressDisplay
              address={contract}
              hideAvatar
              chainId={session.chainId}
            />
          }
        />
      )}
      {contractName && (
        <InfoRow
          symbol="person"
          label={i18n.t('simulation.contract_name')}
          value={contractName}
        />
      )}
      {contractCreatedAt && (
        <InfoRow
          symbol="calendar"
          label={i18n.t('simulation.contract_created_at')}
          value={formatDate(contractCreatedAt)}
        />
      )}
      <InfoRow
        symbol="doc.text.magnifyingglass"
        label={i18n.t('simulation.source_code')}
        value={
          <Tag
            size="12pt"
            color={isSourceCodeVerified ? 'green' : 'labelSecondary'}
            bleed
          >
            {isSourceCodeVerified ? i18n.t('verified') : i18n.t('unverified')}
          </Tag>
        }
      />
    </Box>
  );
}

function TransactionData({
  data,
  expanded,
}: {
  data: string;
  expanded: boolean;
}) {
  return (
    <Box paddingBottom="32px" paddingTop="14px">
      <Text size="12pt" weight="medium" color="labelSecondary">
        <span style={{ wordWrap: 'break-word' }}>{data}</span>
      </Text>
      <CopyButton
        withLabel={expanded}
        onClick={() =>
          copy({
            value: data,
            title: i18n.t('approve_request.transaction_data_copied'),
            description: truncateString(data, 20),
          })
        }
      />
    </Box>
  );
}

function TransferInfoHeader({
  onchainOperation,
  finalTransactionChainId,
}: {
  onchainOperation: OnchainOperation;
  finalTransactionChainId?: number;
}) {
  // TODO: support multiple tokens and other token types
  const fungibleTokenAmount = onchainOperation.fungibleTokenAmounts?.[0];

  const sourceChain = findRainbowChainForChainId(
    fungibleTokenAmount?.fungibleToken?.chainId as number,
  );
  const destinationChain = finalTransactionChainId
    ? findRainbowChainForChainId(finalTransactionChainId)
    : undefined;

  return (
    <>
      {fungibleTokenAmount && (
        <>
          <Text color="label" size="16pt" weight="semibold" whiteSpace="nowrap">
            {`Transfer ${convertRawAmountToDecimalFormat(
              Number(fungibleTokenAmount?.toRawAmount()),
              fungibleTokenAmount.fungibleToken.decimals,
              4,
            )}} ${fungibleTokenAmount.fungibleToken.symbol}`}
          </Text>
        </>
      )}
      <Text color="labelTertiary" size="12pt" weight="regular">
        {`From ${sourceChain?.name} to ${destinationChain?.name}`}
      </Text>
    </>
  );
}

function ApproveInfoHeader({
  onchainOperation,
}: {
  onchainOperation: OnchainOperation;
}) {
  // TODO: support multiple tokens and other token types
  const fungibleTokenAmount = onchainOperation.fungibleTokenAmounts?.[0];

  const chain = findRainbowChainForChainId(
    fungibleTokenAmount?.fungibleToken.chainId as number,
  );

  return (
    <>
      {fungibleTokenAmount && (
        <>
          <Text color="label" size="16pt" weight="semibold" whiteSpace="nowrap">
            {`Approve ${convertRawAmountToDecimalFormat(
              Number(fungibleTokenAmount?.toRawAmount()),
              fungibleTokenAmount.fungibleToken.decimals,
              4,
            )}} ${fungibleTokenAmount.fungibleToken.symbol} `}
          </Text>
        </>
      )}
      <Text color="labelTertiary" size="12pt" weight="regular">
        {`On ${chain?.name}`}
      </Text>
    </>
  );
}

function GenericCallInfoHeader({
  onchainOperation,
  finalOperation,
}: {
  onchainOperation: OnchainOperation;
  dappMetadata: DappMetadata | null;
  finalOperation: OnchainOperation;
}) {
  // TODO: support multiple tokens and other token types
  const fungibleTokenAmount = onchainOperation.fungibleTokenAmounts?.[0];

  return (
    <>
      {fungibleTokenAmount && (
        <>
          <Text color="label" size="16pt" weight="semibold" whiteSpace="nowrap">
            {`${convertRawAmountToDecimalFormat(
              Number(fungibleTokenAmount?.toRawAmount()),
              fungibleTokenAmount.fungibleToken.decimals,
              4,
            )} ${fungibleTokenAmount.fungibleToken.symbol} `}
          </Text>
        </>
      )}

      <Text color="labelTertiary" size="14pt" weight="regular">
        {`From ${findRainbowChainForChainId(onchainOperation.chainId as number)
          ?.name} to ${findRainbowChainForChainId(
          finalOperation.chainId as number,
        )?.name}`}
      </Text>
    </>
  );
}

function FinalCallInfoHeader({
  onchainOperation,
  dappMetadata,
}: {
  onchainOperation: OnchainOperation;
  dappMetadata: DappMetadata | null;
}) {
  // TODO: support multiple tokens and other token types
  const name = dappMetadata?.appName || onchainOperation.to;
  // TODO: support multiple tokens and other token types
  const fungibleTokenAmount = onchainOperation.fungibleTokenAmounts?.[0];

  return (
    <>
      {fungibleTokenAmount && (
        <>
          <Text color="label" size="16pt" weight="semibold" whiteSpace="nowrap">
            {`Using ${convertRawAmountToDecimalFormat(
              Number(fungibleTokenAmount?.toRawAmount()),
              fungibleTokenAmount.fungibleToken.decimals,
              4,
            )} ${fungibleTokenAmount.fungibleToken.symbol} `}
          </Text>
        </>
      )}

      <Text color="labelTertiary" size="14pt" weight="regular">
        {`${name} on ${findRainbowChainForChainId(
          onchainOperation.chainId as number,
        )?.name}`}
      </Text>
    </>
  );
}

export function getSymbol(state: OperationStatus) {
  switch (state) {
    case OperationStatus.INITIAL:
      return 'circle';
    case OperationStatus.SUBMITTING:
      return 'clock';
    case OperationStatus.SUCCESSFUL:
      return 'checkmark.circle.fill';
    case OperationStatus.FAILED:
      return 'xmark.circle';
    default:
      return 'circle';
  }
}

export function getSymbolColor(state: OperationStatus) {
  switch (state) {
    case OperationStatus.INITIAL:
      return 'labelTertiary';
    case OperationStatus.SUBMITTING:
      return 'yellow';
    case OperationStatus.SUCCESSFUL:
      return 'green';
    case OperationStatus.FAILED:
      return 'red';
    default:
      return 'labelTertiary';
  }
}

function TransactionInfo({
  request,
  dappUrl,
  dappMetadata,
  isFirst,
  isLast,
  finalTransactionRequest,
}: {
  request: OnchainOperation;
  dappUrl: string;
  dappMetadata: DappMetadata | null;
  isFirst: boolean;
  isLast: boolean;
  finalTransactionRequest: OnchainOperation;
}) {
  const { activeSession } = useAppSession({ host: dappMetadata?.appHost });
  const chainId =
    findRainbowChainForChainId(request?.chainId as number)?.id ||
    ChainId.mainnet;

  const [expanded, setExpanded] = useState(false);
  const txData = request?.data?.toString() || '';

  const {
    data: simulation,
    status,
    error,
    isRefetching,
  } = useSimulateTransaction({
    chainId,
    transaction: {
      from: request.from || '',
      to: request.to || '',
      value: request.value?.toString() || '0',
      data: request.data?.toString() || '',
    },
    domain: dappUrl,
  });

  const tabLabel = (tab: string) => i18n.t(tab, { scope: 'simulation.tabs' });

  return (
    <>
      <Box display="flex" flexDirection="row">
        {!(isFirst && isLast) && (
          <Box
            display="flex"
            flexDirection="column"
            height="full"
            justifyContent="flex-start"
            alignItems="center"
            paddingRight="16px"
          >
            {isFirst ? (
              <Box
                display="flex"
                flexDirection="column"
                justifyContent="flex-start"
                style={{ width: '0px', height: '32px' }}
                background="white"
              />
            ) : (
              <Box
                display="flex"
                flexDirection="column"
                justifyContent="flex-start"
                style={{ width: '1px', height: '52px' }}
                background="white"
              />
            )}

            <Box display="flex" paddingVertical="4px">
              <Symbol
                symbol={getSymbol(request.status)}
                size={12}
                color={getSymbolColor(request.status)}
                weight="semibold"
              />
            </Box>

            {!isLast && (
              <Box
                display="flex"
                flexDirection="column"
                justifyContent="flex-start"
                style={{ width: '1px', flex: '1' }}
                background="white"
              />
            )}
          </Box>
        )}

        <Box
          as={motion.div}
          transition={{
            layout: {
              type: 'spring',
              bounce: 0.2,
              duration: expanded ? 0.6 : 1,
            },
          }}
          justifyContent="space-between"
          display="flex"
          flexDirection="column"
          padding="20px"
          background="surfaceSecondaryElevated"
          borderRadius="20px"
          borderColor="separatorSecondary"
          borderWidth="1px"
          width="full"
          position="relative"
          style={{ marginTop: isFirst ? '0px' : '20px' }}
        >
          <Box
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            position="relative"
            style={{ height: '36px' }}
            onClick={() => setExpanded((e) => !e)}
          >
            <Box
              display="flex"
              flexDirection="column"
              height="full"
              justifyContent="space-between"
            >
              {request.operation == OperationCallType.NATIVE_TOKEN_TRANSFER && (
                <TransferInfoHeader
                  onchainOperation={request}
                  finalTransactionChainId={finalTransactionRequest.chainId}
                />
              )}
              {request.operation == OperationCallType.APPROVE_ER20_TOKEN && (
                <ApproveInfoHeader onchainOperation={request} />
              )}
              {request.operation == OperationCallType.SUBMIT_INTENT && (
                <GenericCallInfoHeader
                  onchainOperation={request}
                  dappMetadata={dappMetadata}
                  finalOperation={finalTransactionRequest}
                />
              )}
              {request.operation == OperationCallType.FINAL_TRANSACTION && (
                <FinalCallInfoHeader
                  onchainOperation={request}
                  dappMetadata={dappMetadata}
                />
              )}
            </Box>

            <Box
              display="flex"
              flexDirection="column"
              height="full"
              justifyContent="center"
            >
              {expanded ? (
                <Symbol
                  symbol="chevron.up"
                  size={12}
                  color="labelTertiary"
                  weight="semibold"
                />
              ) : (
                <Symbol
                  symbol="chevron.down"
                  size={12}
                  color="labelTertiary"
                  weight="semibold"
                />
              )}
            </Box>
          </Box>
          {expanded && (
            <Box display="flex" flexDirection="column" paddingTop="20px">
              <TransactionInfoTabs
                tabs={[
                  tabLabel('overview'),
                  tabLabel('details'),
                  tabLabel('data'),
                ]}
                expanded={expanded}
                onExpand={() => setExpanded((e) => !e)}
              >
                <TabContent value={tabLabel('overview')}>
                  <Overview
                    chainId={chainId}
                    simulation={simulation}
                    status={
                      status === 'error' && isRefetching ? 'loading' : status
                    }
                    error={error}
                    metadata={dappMetadata}
                  />
                </TabContent>
                <TabContent value={tabLabel('details')}>
                  <TransactionDetails
                    session={activeSession!}
                    simulation={simulation}
                  />
                </TabContent>
                <TabContent value={tabLabel('data')}>
                  <TransactionData data={txData} expanded={expanded} />
                </TabContent>
              </TransactionInfoTabs>
            </Box>
          )}
        </Box>
      </Box>

      {!expanded && simulation && simulation.scanning.result !== 'OK' && (
        <MaliciousRequestWarning
          title={i18n.t('approve_request.malicious_transaction_warning.title')}
          description={simulation.scanning.description}
          symbol="exclamationmark.octagon.fill"
        />
      )}
    </>
  );
}

function InsuficientGasFunds({
  session: { chainId, address },
  onRejectRequest,
}: {
  session: { address: Address; chainId: ChainId };
  onRejectRequest: ({
    preventWindowClose,
  }: {
    preventWindowClose?: boolean;
  }) => void;
}) {
  const { testnetMode } = useTestnetModeStore();
  const isTestnet = testnetMode || isTestnetChainId({ chainId });

  const { nativeAsset } = useNativeAsset({ chainId, address });
  const chainName = getChainName({ chainId });

  const { currentCurrency } = useCurrentCurrencyStore();
  const { data: hasBridgeableBalance } = useUserAssets(
    { address, currency: currentCurrency },
    {
      select(data) {
        const nativeNetworks = nativeAsset?.networks;
        if (!nativeNetworks) return false;
        const bridgeableChains = Object.keys(nativeNetworks);
        // has a balance on any other chain we could bridge from?
        return bridgeableChains.some((chain) => {
          if (+chain === chainId) return false; // skip current chain
          const addressOnChain = nativeNetworks[+chain]?.address;
          if (!addressOnChain) return false;
          const balanceOnChain = data[+chain][addressOnChain].balance;
          return +balanceOnChain.amount > 0;
        });
      },
    },
  );

  const token = `${chainName} ${nativeAsset?.symbol}`;
  const faucet =
    TestnetFaucet[chainId] ||
    'https://www.alchemy.com/list-of/crypto-faucets-on-ethereum';

  const navigate = useRainbowNavigate();

  const setSelectedToken = useSelectedTokenStore((s) => s.setSelectedToken);

  if (!nativeAsset) return null;

  return (
    <Box
      as={motion.div}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      display="flex"
      flexDirection="column"
      padding="20px"
      paddingBottom="2px"
      background="surfaceSecondaryElevated"
      borderRadius="20px"
      borderColor="separatorSecondary"
      borderWidth="1px"
      width="full"
      gap="16px"
    >
      <Inline alignVertical="center" space="12px">
        <ChainBadge chainId={chainId} size={16} />
        <Text size="14pt" weight="bold">
          {+nativeAsset.balance.amount > 0
            ? i18n.t('approve_request.insufficient_gas_funds', { token })
            : i18n.t('approve_request.no_gas_funds', { token })}
        </Text>
      </Inline>
      <Text size="12pt" weight="medium" color="labelQuaternary">
        {+nativeAsset.balance.amount > 0
          ? i18n.t('approve_request.insufficient_gas_funds_description', {
              token,
            })
          : i18n.t('approve_request.no_gas_funds_description', {
              token,
            })}
      </Text>
      <Stack marginHorizontal="-8px">
        <Separator color="separatorTertiary" />

        {hasBridgeableBalance && (
          <Button
            paddingHorizontal="8px"
            height="44px"
            variant="transparent"
            color="blue"
            onClick={() => {
              setSelectedToken(nativeAsset);
              navigate(ROUTES.BRIDGE, { replace: true });
              onRejectRequest({ preventWindowClose: true });
              triggerToast({
                title: i18n.t('approve_request.request_rejected'),
                description: i18n.t('approve_request.bridge_and_try_again'),
              });
            }}
          >
            <Inline alignVertical="center" space="12px" wrap={false}>
              <Symbol
                size={16}
                symbol="arrow.turn.up.right"
                color="blue"
                weight="bold"
              />
              <Text size="14pt" weight="bold" color="blue">
                {i18n.t('approve_request.bridge_to', { chain: chainName })}
              </Text>
            </Inline>
          </Button>
        )}
        {!hasBridgeableBalance && !isTestnet && (
          <Button
            paddingHorizontal="8px"
            height="44px"
            variant="transparent"
            color="blue"
            onClick={() => {
              navigate(ROUTES.BUY, { replace: true });
              onRejectRequest({ preventWindowClose: true });
              triggerToast({
                title: i18n.t('approve_request.request_rejected'),
                description: i18n.t('approve_request.buy_and_try_again'),
              });
            }}
          >
            <Inline alignVertical="center" space="12px" wrap={false}>
              <Symbol
                size={16}
                symbol="creditcard.fill"
                color="blue"
                weight="bold"
              />
              <Text size="14pt" weight="bold" color="blue">
                {i18n.t('approve_request.buy_gas', { token })}
              </Text>
            </Inline>
          </Button>
        )}
        {!hasBridgeableBalance && isTestnet && (
          <Button
            paddingHorizontal="8px"
            height="44px"
            variant="transparent"
            color="blue"
            onClick={() => {
              onRejectRequest({ preventWindowClose: false });
              goToNewTab({ url: faucet });
            }}
          >
            <Inline alignVertical="center" space="12px" wrap={false}>
              <Symbol
                size={16}
                symbol="spigot.fill"
                color="blue"
                weight="bold"
              />
              <Text size="14pt" weight="bold" color="blue">
                {i18n.t('approve_request.get_testnet_gas', {
                  token: nativeAsset?.symbol,
                })}
              </Text>
            </Inline>
          </Button>
        )}

        <Separator color="separatorTertiary" />

        <Button
          paddingHorizontal="8px"
          height="44px"
          variant="transparent"
          color="blue"
          onClick={() => copyAddress(address)}
        >
          <Inline alignVertical="center" space="12px" wrap={false}>
            <Symbol
              size={16}
              symbol="square.on.square"
              color="blue"
              weight="bold"
            />
            <Text size="14pt" weight="bold" color="blue">
              {i18n.t('approve_request.copy_deposit_address')}
            </Text>
          </Inline>
        </Button>
      </Stack>
    </Box>
  );
}

export function SendTransactionInfo({
  transactionRequests,
  dappUrl,
  onRejectRequest,
}: SendTransactionProps) {
  const { data: dappMetadata } = useDappMetadata({ url: dappUrl });
  const { activeSession } = useAppSession({ host: dappMetadata?.appHost });
  const isScamDapp = dappMetadata?.status === DAppStatus.Scam;
  const finalTransaction = transactionRequests[transactionRequests.length - 1];
  const hasEnoughGas = true; // useHasEnoughGas(activeSession);

  return (
    <Box
      background="surfacePrimaryElevatedSecondary"
      style={{ minHeight: 397, overflowY: 'scroll' }}
      borderColor="separatorTertiary"
      borderWidth="1px"
      paddingHorizontal="20px"
      paddingVertical="20px"
      position="relative"
      display="flex"
      flexDirection="column"
      justifyContent="flex-start"
      gap="24px"
      height="full"
    >
      <AnimatePresence mode="popLayout">
        {
          <motion.div
            style={{ paddingTop: 20 }}
            initial={{ opacity: 0, scale: 0.9, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -8 }}
          >
            <Stack space="16px" alignItems="center">
              <DappIcon appLogo={dappMetadata?.appLogo} size="36px" />
              <Stack space="12px">
                <DappHostName
                  hostName={dappMetadata?.appHostName}
                  dappStatus={dappMetadata?.status}
                />
                <Text
                  align="center"
                  size="14pt"
                  weight="bold"
                  color={isScamDapp ? 'red' : 'labelSecondary'}
                >
                  {isScamDapp
                    ? i18n.t('approve_request.dangerous_request')
                    : i18n.t('approve_request.transaction_request')}
                </Text>
              </Stack>
            </Stack>
          </motion.div>
        }
      </AnimatePresence>

      {hasEnoughGas ? (
        <Box
          background="surfacePrimaryElevatedSecondary"
          display="flex"
          flexDirection="column"
          justifyContent="flex-start"
          gap="0px"
        >
          {transactionRequests.map((tx, i) => (
            <TransactionInfo
              isFirst={i === 0}
              isLast={i === transactionRequests.length - 1}
              key={i}
              request={tx}
              dappMetadata={dappMetadata}
              dappUrl={dappUrl}
              finalTransactionRequest={finalTransaction}
            />
          ))}
        </Box>
      ) : (
        activeSession && (
          <InsuficientGasFunds
            session={activeSession}
            onRejectRequest={onRejectRequest}
          />
        )
      )}
    </Box>
  );
}
