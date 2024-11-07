import { TransactionRequest } from '@ethersproject/abstract-provider';
import { id } from '@ethersproject/hash';
import {
  FungibleToken,
  FungibleTokenAmount,
  OperationCallType,
  Quote,
  TokenType,
  TransactionDetails,
  formulateTransactions,
} from '@orbykit/core';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { usePendingRequestStore } from '~/core/state';
import { OnchainOperation, OperationStatus } from '~/core/types/transactions';

export const useFormulateTransactions = (request?: TransactionRequest) => {
  const [state, setState] = useState<'formulating' | 'ready' | 'error'>(
    'formulating',
  );

  const {
    getTransactionOperations,
    addTransactionOperations,
    // transactionOperationList,
    // removeTransactionOperations,
  } = usePendingRequestStore();

  const info = useMemo(() => {
    // if (transactionOperationList.length > 0) {
    //   const operations = transactionOperationList[0];
    //   removeTransactionOperations(operations.operationsId);
    // }

    console.log('useFormulateTransactions 0', request);
    if (!request) {
      return undefined;
    }

    const details: TransactionDetails = {
      to: request.to,
      from: request.from,
      data: request.data as string,
      gasLimit: request.gasLimit ? String(request.gasLimit) : undefined,
      gasPrice: request.gasPrice ? String(request.gasPrice) : undefined,
      value: request.value ? String(request.value) : undefined,
      maxFeePerGas: request.maxFeePerGas
        ? String(request.maxFeePerGas)
        : undefined,
      maxPriorityFeePerGas: request.maxPriorityFeePerGas
        ? String(request.maxPriorityFeePerGas)
        : undefined,
      enableCcipRead: request.ccipReadEnabled,
      chainId: BigInt(request.chainId as number),
      // destinationName: '',
      // requiredTokens: [],
      nonce: request.nonce ? Number(request.nonce) : undefined,
    };

    let transactionRequests: OnchainOperation[] | undefined;
    let operationsId: string | undefined;
    if (details && details.data) {
      const hash = id(details.data);
      operationsId = `${details.chainId}:${details.from}:${details.to}:${hash}`;
      transactionRequests = getTransactionOperations(operationsId);
    }

    return { details, transactionRequests, operationsId, from: details.from };
  }, [getTransactionOperations, request]);

  const fetchData = useCallback(async () => {
    console.log('useFormulateTransactions 11', info);
    if (!info || !info.details) {
      return;
    } else if (info.transactionRequests) {
      setState('ready');
      return;
    }

    console.log('useFormulateTransactions 12');
    const response = await formulateTransactions(
      info!.from as string,
      info!.details,
    );

    console.log('useFormulateTransactions 13', response);

    // console.log('useFormulateTransactions 22', response);
    if (response && response?.route) {
      const transactions: OnchainOperation[] = (response.route as Quote[])
        .map((route) => {
          if (!route.onchainOperations) {
            return [];
          }

          return route.onchainOperations?.map((op) => {
            const fungibleTokenAmounts =
              route.inputToken.type() == TokenType.FUNGIBLE_TOKEN
                ? [
                    FungibleTokenAmount.fromRawAmount(
                      route.inputToken as FungibleToken,
                      route.inputAmount.toString(),
                    ),
                  ]
                : undefined;

            return {
              from: op.from,
              to: op.to,
              chainId: Number(op.chainId),
              value: op.value?.toRawAmount(),
              gasLimit: op.gasLimit,
              gasPrice: op.gasPrice,
              customData: op.customData,
              data: op.data,
              operation: op.type,
              fungibleTokenAmounts,
              status: OperationStatus.INITIAL,
            };
          });
        })
        .flat();

      const finalTransaction: OnchainOperation = {
        from: response.finalTransactionRequestDetails.from,
        to: response.finalTransactionRequestDetails.to,
        chainId: Number(response.finalTransactionRequestDetails.chainId),
        value: response.finalTransactionRequestDetails.value?.toRawAmount(),
        gasLimit: response.finalTransactionRequestDetails.gasLimit,
        gasPrice: response.finalTransactionRequestDetails.gasPrice,
        customData: response.finalTransactionRequestDetails.customData,
        data: response.finalTransactionRequestDetails.data,
        operation: OperationCallType.FINAL_TRANSACTION,
        fungibleTokenAmounts:
          response.preTransactionRequiredState?.fungibleTokenAmounts,
        status: OperationStatus.INITIAL,
      };
      const operations = [...transactions, finalTransaction];
      addTransactionOperations(info.operationsId!, operations);
      console.log('useFormulateTransactions 23', operations);
      setState('ready');
    } else {
      console.log('useFormulateTransactions 24');
      setState('error');
    }
  }, [info, addTransactionOperations]);

  useEffect(() => {
    fetchData().catch((er) => {
      console.error(`error with formulating transactions: ${er}`);
    });
  }, [fetchData]);

  return {
    isFormulating: state == 'formulating',
    ready: state == 'ready',
    error: state == 'error',
    transactionRequests: info?.transactionRequests,
    operationsId: info?.operationsId,
  };
};
