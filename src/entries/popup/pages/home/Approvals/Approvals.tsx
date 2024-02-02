import { ReactNode, useCallback, useRef, useState } from 'react';
import { Chain } from 'wagmi';

import { i18n } from '~/core/languages';
import { SUPPORTED_MAINNET_CHAINS } from '~/core/references';
import { shortcuts } from '~/core/references/shortcuts';
import {
  Approval,
  ApprovalSpender,
  useApprovals,
} from '~/core/resources/approvals/approvals';
import { useCurrentAddressStore, useCurrentCurrencyStore } from '~/core/state';
import { useCurrentThemeStore } from '~/core/state/currentSettings/currentTheme';
import { useUserChainsStore } from '~/core/state/userChains';
import { ChainId } from '~/core/types/chains';
import { truncateAddress } from '~/core/utils/address';
import { parseUserAsset } from '~/core/utils/assets';
import { getBlockExplorerHostForChain } from '~/core/utils/chains';
import { copy } from '~/core/utils/copy';
import { convertRawAmountToDecimalFormat } from '~/core/utils/numbers';
import { getTxExplorerUrl } from '~/core/utils/tabs';
import { getBlockExplorerName } from '~/core/utils/transactions';
import {
  Box,
  Button,
  Column,
  Columns,
  Inline,
  Inset,
  Separator,
  Stack,
  Symbol,
  Text,
  TextOverflow,
} from '~/design-system';
import { Lens } from '~/design-system/components/Lens/Lens';
import { Row, Rows } from '~/design-system/components/Rows/Rows';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '~/entries/popup/components/ContextMenu/ContextMenu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '~/entries/popup/components/DropdownMenu/DropdownMenu';
import { HomeMenuRow } from '~/entries/popup/components/HomeMenuRow/HomeMenuRow';
import { ShortcutHint } from '~/entries/popup/components/ShortcutHint/ShortcutHint';
import { useKeyboardShortcut } from '~/entries/popup/hooks/useKeyboardShortcut';

import { CoinIcon } from '../../../components/CoinIcon/CoinIcon';
import { useRainbowChains } from '../../../hooks/useRainbowChains';
import { gradientBorderDark, gradientBorderLight } from '../NFTs/NFTs.css';

import { RevokeApprovalSheet } from './RevokeApprovalSheet';

type Tab = 'tokens' | 'nfts';

type SortType = 'recent' | 'alphabetical';

const SortDropdown = ({
  sort,
  setSort,
}: {
  sort: SortType;
  setSort: (sortType: SortType) => void;
}) => {
  const onValueChange = useCallback(
    (value: SortType) => {
      setSort(value);
    },
    [setSort],
  );
  const { currentTheme } = useCurrentThemeStore();
  const [open, setIsOpen] = useState(false);

  useKeyboardShortcut({
    condition: () => open,
    handler: (e) => {
      e.stopImmediatePropagation();
      if (e.key === shortcuts.nfts.SORT_RECENT.key) {
        onValueChange('recent');
        setIsOpen(false);
      } else if (e.key === shortcuts.nfts.SORT_ABC.key) {
        onValueChange('alphabetical');
        setIsOpen(false);
      }
    },
  });

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(openChange) => !openChange && setIsOpen(false)}
    >
      <DropdownMenuTrigger asChild>
        <Box onClick={() => setIsOpen(true)}>
          <Lens
            className={
              currentTheme === 'dark' ? gradientBorderDark : gradientBorderLight
            }
            style={{ display: 'flex', alignItems: 'center' }}
            testId={'nfts-sort-dropdown'}
          >
            <Box style={{ paddingRight: 7, paddingLeft: 7 }}>
              <Inline alignVertical="center" space="6px">
                <Symbol
                  symbol={sort === 'recent' ? 'clock' : 'list.bullet'}
                  weight="bold"
                  size={13}
                  color="labelSecondary"
                />
                <Text weight="bold" size="14pt" color="label">
                  {sort === 'recent'
                    ? i18n.t('nfts.sort_option_recent')
                    : i18n.t('nfts.sort_option_abc')}
                </Text>
                <Symbol
                  symbol="chevron.down"
                  weight="bold"
                  size={10}
                  color="labelTertiary"
                />
              </Inline>
            </Box>
          </Lens>
        </Box>
      </DropdownMenuTrigger>
      <DropdownMenuContent marginRight="16px" marginTop="6px">
        <DropdownMenuRadioGroup
          onValueChange={(value) => onValueChange(value as typeof sort)}
        >
          <Stack space="4px">
            <Stack>
              <DropdownMenuRadioItem highlightAccentColor value="recent">
                <HomeMenuRow
                  leftComponent={
                    <Symbol size={12} symbol="clock" weight="semibold" />
                  }
                  centerComponent={
                    <Text size="14pt" weight="semibold">
                      {i18n.t('nfts.sort_option_recent_long')}
                    </Text>
                  }
                  rightComponent={
                    <ShortcutHint hint={shortcuts.nfts.SORT_RECENT.display} />
                  }
                />
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem highlightAccentColor value="alphabetical">
                <HomeMenuRow
                  leftComponent={
                    <Symbol size={12} symbol="list.bullet" weight="semibold" />
                  }
                  centerComponent={
                    <Text
                      size="14pt"
                      weight="semibold"
                      testId={'nfts-sort-option-abc'}
                    >
                      {i18n.t('nfts.sort_option_abc_long')}
                    </Text>
                  }
                  rightComponent={
                    <ShortcutHint hint={shortcuts.nfts.SORT_ABC.display} />
                  }
                />
              </DropdownMenuRadioItem>
            </Stack>
          </Stack>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

function ApprovalHeader({
  sort,
  activeTab,
  setSort,
  onSelectTab,
}: {
  sort: SortType;
  activeTab: Tab;
  setSort: (sortType: SortType) => void;
  onSelectTab: (tab: Tab) => void;
}) {
  return (
    <Inset bottom="20px" top="8px">
      <Box
        display="flex"
        justifyContent="space-between"
        paddingHorizontal="20px"
        style={{
          maxHeight: 11,
          textTransform: 'capitalize',
        }}
        width="full"
        alignItems="center"
      >
        <Inline alignVertical="bottom" space="16px">
          <Box onClick={() => onSelectTab?.('tokens')}>
            <Inline space="5px" alignVertical="center">
              <Symbol
                symbol="circlebadge.2.fill"
                weight="regular"
                size={12}
                color={activeTab === 'tokens' ? 'label' : 'labelTertiary'}
              />
              <Text
                size="16pt"
                weight="heavy"
                color={activeTab === 'tokens' ? 'label' : 'labelTertiary'}
              >
                {i18n.t(`tabs.tokens`)}
              </Text>
            </Inline>
          </Box>
          <Box onClick={() => onSelectTab?.('nfts')}>
            <Inline space="5px" alignVertical="center">
              <Symbol
                symbol="square.grid.2x2.fill"
                weight="regular"
                size={12}
                color={activeTab === 'nfts' ? 'label' : 'labelTertiary'}
              />
              <Text
                size="16pt"
                weight="heavy"
                color={activeTab === 'nfts' ? 'label' : 'labelTertiary'}
              >
                {i18n.t(`tabs.nfts`)}
              </Text>
            </Inline>
          </Box>
        </Inline>

        <Inline alignVertical="center" space="8px">
          <SortDropdown sort={sort} setSort={setSort} />
        </Inline>
      </Box>
    </Inset>
  );
}

const sortApprovals = (
  sort: SortType,
  a1: { approval: Approval; spender: ApprovalSpender },
  a2: { approval: Approval; spender: ApprovalSpender },
) => {
  if (sort === 'recent') {
    return new Date(a1.spender.tx_time) < new Date(a2.spender.tx_time) ? 1 : -1;
  }
  return a1.approval?.asset.symbol?.toLowerCase() <
    a2.approval?.asset.symbol?.toLowerCase()
    ? -1
    : 1;
};

export const Approvals = () => {
  const { currentAddress } = useCurrentAddressStore();
  const { currentCurrency } = useCurrentCurrencyStore();
  const { rainbowChains } = useRainbowChains();
  const { userChains } = useUserChainsStore();
  const [showRevokeSheet, setShowRevokeSheet] = useState(false);
  const [revokeApproval, setRevokeApproval] = useState<{
    approval: Approval | null;
    spender: ApprovalSpender | null;
  }>({ approval: null, spender: null });

  const [sort, setSort] = useState<SortType>('recent');
  const [activeTab, setActiveTab] = useState<Tab>('tokens');
  const supportedMainnetIds = SUPPORTED_MAINNET_CHAINS.map((c: Chain) => c.id);

  const chainIds = rainbowChains
    .filter((c) => supportedMainnetIds.includes(c.id) && userChains[c.id])
    .map((c) => c.id);

  const { data: approvalsData } = useApprovals(
    {
      address: currentAddress,
      chainIds: chainIds,
      currency: currentCurrency,
    },
    {
      select(data) {
        if (data) {
          const newPayload = data.payload.filter((approval) =>
            activeTab === 'nfts'
              ? approval.asset.type === 'nft'
              : approval.asset.type !== 'nft',
          );
          return { meta: data?.meta, payload: newPayload };
        }
        return null;
      },
    },
  );

  const approvals = approvalsData?.payload || [];

  const tokenApprovals = approvals
    ?.map((approval) =>
      approval.spenders.map((spender) => ({
        approval,
        spender,
      })),
    )
    .flat()
    .sort((a1, a2) => sortApprovals(sort, a1, a2));

  return (
    <Box>
      <Box
        style={{
          overflow: 'scroll',
        }}
      >
        <ApprovalHeader
          sort={sort}
          activeTab={activeTab}
          setSort={setSort}
          onSelectTab={setActiveTab}
        />
        <Stack space="16px">
          <Rows alignVertical="top">
            {tokenApprovals?.map((tokenApproval, i) => (
              <Row height="content" key={i}>
                <TokenApproval
                  approval={tokenApproval.approval}
                  spender={tokenApproval.spender}
                  onRevoke={() => {
                    setRevokeApproval(tokenApproval);
                    setShowRevokeSheet(true);
                  }}
                />
              </Row>
            ))}
          </Rows>
        </Stack>
      </Box>
      <RevokeApprovalSheet
        show={showRevokeSheet}
        approval={revokeApproval.approval}
        spender={revokeApproval.spender}
        onCancel={() => setShowRevokeSheet(false)}
      />
    </Box>
  );
};

const getMenuComponents = ({ type }: { type: 'dropdown' | 'context' }) => {
  if (type === 'dropdown') {
    return {
      Menu: DropdownMenu,
      MenuContent: DropdownMenuContent,
      MenuRadioGroup: DropdownMenuRadioGroup,
      MenuRadioItem: DropdownMenuRadioItem,
      MenuTrigger: DropdownMenuTrigger,
      MenuItem: DropdownMenuItem,
    };
  }
  return {
    Menu: ContextMenu,
    MenuContent: ContextMenuContent,
    MenuRadioGroup: ContextMenuContent,
    MenuRadioItem: ContextMenuContent,
    MenuTrigger: ContextMenuTrigger,
    MenuItem: ContextMenuItem,
  };
};

export const TokenApprovalContextMenu = ({
  chainId,
  spender,
  children,
  type = 'context',
  onTrigger,
  onRevokeApproval,
}: {
  chainId: ChainId;
  spender: ApprovalSpender;
  children: ReactNode;
  type?: 'dropdown' | 'context';
  onRevokeApproval: () => void;
  onTrigger?: () => void;
}) => {
  const copySpenderRef = useRef<HTMLDivElement>(null);
  const viewOnExplorerRef = useRef<HTMLDivElement>(null);
  const revokeRef = useRef<HTMLDivElement>(null);

  const explorerHost = getBlockExplorerName(chainId);
  const explorer =
    getBlockExplorerHostForChain(chainId || ChainId.mainnet) || '';
  const explorerUrl = getTxExplorerUrl(explorer, spender.tx_hash);

  const [tokenContextMenuOpen, setTokenContextMenuOpen] = useState(false);
  useKeyboardShortcut({
    condition: () => tokenContextMenuOpen,
    handler: (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === shortcuts.activity.COPY_TRANSACTION.key) {
        copySpenderRef.current?.click();
      }
      if (e.key === shortcuts.activity.VIEW_TRANSACTION.key) {
        viewOnExplorerRef.current?.click();
      }
      if (e.key === shortcuts.activity.REFRESH_TRANSACTIONS.key) {
        revokeRef.current?.click();
      }
    },
  });

  const { Menu, MenuContent, MenuTrigger, MenuItem } = getMenuComponents({
    type,
  });

  return (
    <Menu onOpenChange={setTokenContextMenuOpen}>
      <MenuTrigger asChild onTrigger={onTrigger}>
        {children}
      </MenuTrigger>
      <MenuContent>
        <MenuItem
          symbolLeft="doc.on.doc.fill"
          shortcut={shortcuts.activity.COPY_TRANSACTION.display}
          onSelect={() =>
            copy({
              value: spender.contract_address,
              title: 'Spender Address Copied',
              description: truncateAddress(spender.contract_address),
            })
          }
        >
          <Box ref={copySpenderRef}>
            <Stack space="8px">
              <Text size="14pt" weight="semibold">
                {'Copy Spender'}
              </Text>
              <TextOverflow size="11pt" color="labelTertiary" weight="medium">
                {truncateAddress(spender.contract_address)}
              </TextOverflow>
            </Stack>
          </Box>
        </MenuItem>
        {explorerUrl && (
          <>
            <MenuItem
              symbolLeft="binoculars.fill"
              onSelect={() => window.open(explorerUrl, '_blank')}
              shortcut={shortcuts.activity.VIEW_TRANSACTION.display}
            >
              <Box ref={viewOnExplorerRef}>
                <Text size="14pt" weight="semibold">
                  {i18n.t('token_details.view_on', { explorer: explorerHost })}
                </Text>
              </Box>
            </MenuItem>
            <Box paddingVertical="4px">
              <Separator color="separatorSecondary" />
            </Box>
            <MenuItem
              color="red"
              symbolLeft="xmark.circle.fill"
              onSelect={onRevokeApproval}
              shortcut={shortcuts.activity.REFRESH_TRANSACTIONS.display}
            >
              <Box ref={revokeRef}>
                <Text size="14pt" weight="semibold" color="red">
                  {'Revoke Approval'}
                </Text>
              </Box>
            </MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
};

const TokenApproval = ({
  approval,
  spender,
  onRevoke,
}: {
  approval: Approval;
  spender: ApprovalSpender;
  onRevoke: () => void;
}) => {
  const [revokeButtonVisible, setRevokeButtonVisible] = useState(false);

  const onMouseEnter = () => setRevokeButtonVisible(true);
  const onMouseLeave = () => setRevokeButtonVisible(false);

  const { currentCurrency } = useCurrentCurrencyStore();

  return (
    <TokenApprovalContextMenu
      chainId={approval.chain_id}
      spender={spender}
      onRevokeApproval={onRevoke}
    >
      <Box
        paddingHorizontal="8px"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <Box
          background={{
            default: 'transparent',
            hover: 'surfacePrimaryElevatedSecondary',
          }}
          borderRadius="12px"
        >
          <Inset horizontal="12px" vertical="8px">
            <Columns alignVertical="center" space="4px">
              <Column>
                <Columns space="8px" alignVertical="center">
                  <Column width="content">
                    <CoinIcon
                      asset={parseUserAsset({
                        asset: approval.asset,
                        currency: currentCurrency,
                        balance: '0',
                      })}
                      badge
                    />
                  </Column>
                  <Column>
                    <Stack space="8px">
                      <TextOverflow
                        align="left"
                        size="14pt"
                        weight="semibold"
                        color="label"
                      >
                        {approval?.asset?.name}
                      </TextOverflow>

                      <TextOverflow
                        align="left"
                        size="12pt"
                        weight="semibold"
                        color="label"
                      >
                        {`${
                          spender.contract_name
                            ? `${spender.contract_name} • `
                            : ''
                        } ${truncateAddress(spender.contract_address)}`}
                      </TextOverflow>
                    </Stack>
                  </Column>
                </Columns>
              </Column>
              <Column width="content">
                {revokeButtonVisible ? (
                  <Button
                    color="red"
                    height="28px"
                    variant="plain"
                    borderRadius="8px"
                    onClick={onRevoke}
                  >
                    <Text size="14pt" weight="bold" color="label">
                      {i18n.t('approvals.revoke.action')}
                    </Text>
                  </Button>
                ) : (
                  <Box
                    paddingVertical="5px"
                    paddingHorizontal="6px"
                    borderRadius="6px"
                    borderDashedWidth="1px"
                    borderColor="separatorSecondary"
                  >
                    <TextOverflow
                      align="center"
                      size="11pt"
                      weight="semibold"
                      color="labelTertiary"
                    >
                      {spender?.quantity_allowed.toLowerCase() === 'unlimited'
                        ? spender?.quantity_allowed
                        : `${convertRawAmountToDecimalFormat(
                            spender?.quantity_allowed || '0',
                            approval?.asset.decimals,
                          )} ${approval?.asset.symbol}`}
                    </TextOverflow>
                  </Box>
                )}
              </Column>
            </Columns>
          </Inset>
        </Box>
      </Box>
    </TokenApprovalContextMenu>
  );
};
