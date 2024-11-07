import { CurrencyAmount, listBalances } from '@orbykit/core';
import { useCallback, useEffect, useState } from 'react';

import { AddressOrEth, ParsedUserAsset } from '~/core/types/assets';
import { ChainName } from '~/core/types/chains';
import { getChainName } from '~/core/utils/chains';
import { convertRawAmountToDecimalFormat } from '~/core/utils/numbers';

export const useBalances = (account: string) => {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [assets, setAssets] = useState<ParsedUserAsset[]>([]);
  const [fiatTotal, setFiatTotal] = useState<string>('$0');
  const [tokenListByAsset, setTokenListByAsset] = useState<
    Map<string, ParsedUserAsset[]>
  >(new Map<string, ParsedUserAsset[]>());
  const [isInCombinedList, setIsInCombinedList] = useState<
    Map<string, boolean>
  >(new Map<string, boolean>());

  const fetchData = useCallback(async () => {
    const response = await listBalances(account);

    if (response) {
      const zero = CurrencyAmount.fromRawAmount(
        response[0].totalInFiatCurrency!.currency,
        0,
      );

      const total = response.reduce((acc, balance) => {
        return balance.totalInFiatCurrency
          ? balance.totalInFiatCurrency.add(acc)
          : acc;
      }, zero);

      const userAssets: ParsedUserAsset[] = response.map((balance) => {
        const { total, totalInFiatCurrency, tokenBalances } = balance;
        const parentId = `${total!.currency?.name}:${total!.currency?.symbol}`;
        const decimals =
          total!.currency.symbol == 'USDC' ? 6 : total!.currency.decimals;

        const tokens: ParsedUserAsset[] = tokenBalances.map((tokenAmount) => {
          const chain = getChainName({
            chainId: tokenAmount.fungibleToken.chainId,
          });

          return {
            address: tokenAmount.fungibleToken.address as AddressOrEth,
            balance: {
              amount: tokenAmount.toRawAmount().toString(),
              display: `${convertRawAmountToDecimalFormat(
                Number(tokenAmount.toRawAmount()),
                tokenAmount.fungibleToken.decimals,
                4,
              )} ${tokenAmount.fungibleToken.symbol}`,
            },
            colors: { primary: '#2775CA' },
            icon_url: tokenAmount.fungibleToken.logoUrl,
            isNativeAsset: false,
            name: tokenAmount.fungibleToken.name as string,
            symbol: tokenAmount.fungibleToken.symbol,
            uniqueId: `${tokenAmount.fungibleToken.chainId}:${tokenAmount.fungibleToken.address}`,
            parentId: parentId,
            chainId: tokenAmount.fungibleToken.chainId,
            chainName: chain as ChainName,
            decimals: tokenAmount.fungibleToken.decimals,
            native: {
              balance: {
                amount: tokenAmount
                  .amountInFiatCurrency!.toRawAmount()
                  .toString(),
                display: `$${convertRawAmountToDecimalFormat(
                  Number(tokenAmount.amountInFiatCurrency!.toRawAmount()),
                  6,
                )}`,
              },
            },
          };
        });

        setTokenListByAsset((prev) => {
          prev.set(parentId, tokens);
          return prev;
        });

        return {
          address:
            total!.currency.symbol == 'ETH'
              ? 'eth'
              : ('0x0000000000000000000000000000000000000000' as AddressOrEth),
          balance: {
            amount: total!.toRawAmount().toString(),
            display: `${convertRawAmountToDecimalFormat(
              Number(total?.toRawAmount()),
              decimals,
              4,
            )} ${total!.currency?.symbol}`,
          },
          colors: { primary: '#2775CA' },
          icon_url: total!.currency.logoUrl,
          isNativeAsset: total!.currency.symbol == 'ETH',
          name: total!.currency.name as string,
          symbol: total!.currency.symbol,
          uniqueId: parentId,
          parentId: parentId,
          decimals: decimals,
          native: {
            balance: {
              amount: totalInFiatCurrency!.toRawAmount().toString(),
              display: `$${convertRawAmountToDecimalFormat(
                Number(totalInFiatCurrency?.toRawAmount()),
                6,
              )}`,
            },
          },
        };
      });

      setAssets(userAssets);
      setState('ready');
      setFiatTotal(
        `$${convertRawAmountToDecimalFormat(Number(total?.toRawAmount()), 6)}`,
      );
    } else {
      setState('error');
    }
  }, [account, setFiatTotal]);

  const update = useCallback(async () => {
    fetchData().catch((er) => {
      console.error(`error with fetching balances: ${er}`);
    });
  }, [fetchData]);

  const onCombineLists = useCallback(
    (uniqueId: string) => {
      const index = assets.findIndex((asset) => asset.uniqueId === uniqueId);
      const assetTokens = tokenListByAsset.get(uniqueId);
      if (isInCombinedList.get(uniqueId) == true) {
        assets.splice(index + 1, assetTokens!.length);
      } else {
        assets.splice(index + 1, 0, ...assetTokens!);
      }

      setIsInCombinedList((prev) => {
        prev.set(uniqueId, !isInCombinedList.get(uniqueId));
        return prev;
      });

      setAssets([...assets]);
    },
    [isInCombinedList, assets, tokenListByAsset],
  );

  useEffect(() => {
    fetchData().catch((er) => {
      console.error(`error with fetching balances: ${er}`);
    });
  }, [fetchData]);

  return {
    data: assets,
    tokenListByAsset,
    fiatTotal,
    isLoading: state == 'loading',
    ready: state == 'ready',
    error: state == 'error',
    refetch: update,
    onCombineLists,
  };
};
