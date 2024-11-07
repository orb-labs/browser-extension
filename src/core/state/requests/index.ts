import {
  FungibleToken,
  FungibleTokenAmount,
  OperationCallType,
} from '@orbykit/core';
import _ from 'lodash';
import create from 'zustand';

import { OnchainOperation, OperationStatus } from '~/core/types/transactions';

import { ProviderRequestPayload } from '../../transports/providerRequestTransport';
import { createStore } from '../internal/createStore';

export interface PendingRequestsStore {
  transactionOperationList: {
    operationsId: string;
    operations: {
      chainId: number | undefined;
      data: string | undefined;
      from: string | undefined;
      fungibleTokenAmounts:
        | {
            chainId: number;
            address: string;
            decimals: number;
            symbol: string;
            name: string;
            isNative: boolean;
            logoUrl: string | undefined;
            value: bigint;
          }[]
        | undefined;
      operation: OperationCallType;
      to: string | undefined;
      status: OperationStatus;
      transactionId?: string;
    }[];
  }[];
  pendingRequests: ProviderRequestPayload[];
  addPendingRequest: (request: ProviderRequestPayload) => void;
  removePendingRequest: (id: number) => void;
  addTransactionOperations: (
    id: string,
    operations: OnchainOperation[],
  ) => void;
  getTransactionOperations: (id: string) => undefined | OnchainOperation[];
  removeTransactionOperations: (id?: string) => void;
  updateTransactionStatus: (
    statuses: { status: OperationStatus; transactionId?: string }[],
    operationsId?: string,
  ) => void;
}

export const pendingRequestStore = createStore<PendingRequestsStore>(
  (set, get) => ({
    transactionOperationList: [],
    pendingRequests: [],
    addPendingRequest: (newRequest) => {
      const pendingRequests = get().pendingRequests;
      set({ pendingRequests: pendingRequests.concat([newRequest]) });
    },
    removePendingRequest: (id) => {
      const pendingRequests = get().pendingRequests;
      set({
        pendingRequests: pendingRequests.filter((request) => request.id !== id),
      });
    },
    addTransactionOperations: (
      operationsId: string,
      operations: OnchainOperation[],
    ) => {
      const formattedData = operations.map((operation) => {
        const fungibleTokenAmounts = operation.fungibleTokenAmounts?.map(
          (amount) => {
            return {
              chainId: amount.fungibleToken.chainId,
              address: amount.fungibleToken.address,
              decimals: amount.fungibleToken.decimals,
              symbol: amount.fungibleToken.symbol,
              name: amount.fungibleToken.name,
              isNative: amount.fungibleToken.isNative,
              logoUrl: amount.fungibleToken.logoUrl,
              value: amount.toRawAmount(),
            };
          },
        );

        return {
          chainId: operation.chainId,
          data: operation.data?.toString(),
          from: operation.from,
          fungibleTokenAmounts,
          operation: operation.operation,
          to: operation.to,
          status: operation.status,
          transactionId: operation.transactionId,
        };
      });

      get().removeTransactionOperations(operationsId);
      const transactionOperations = get().transactionOperationList;
      const transactionOperationList = transactionOperations.concat([
        { operationsId, operations: formattedData },
      ]);

      console.log('new array', transactionOperationList);

      set({ transactionOperationList });
    },
    removeTransactionOperations: (operationsId?: string) => {
      const transactionOperations = get().transactionOperationList;
      set({
        transactionOperationList: transactionOperations.filter(
          (request) => request.operationsId != operationsId,
        ),
      });
    },
    getTransactionOperations: (operationsId: string) => {
      const transactionOperations = get().transactionOperationList;
      const operation = transactionOperations.find(
        (request) => request.operationsId == operationsId,
      );

      console.log('getTransactionOperations', operationsId, operation);

      return operation?.operations?.map((operation) => {
        const fungibleTokenAmounts = operation.fungibleTokenAmounts?.map(
          (token) => {
            const fungibleToken = new FungibleToken(
              token.chainId,
              token.address,
              token.decimals,
              token.symbol,
              token.name,
              undefined,
              token.isNative,
              token.logoUrl,
            );

            const amount = FungibleTokenAmount.fromRawAmount(
              fungibleToken,
              token.value.toString(),
            );

            return amount;
          },
        );

        return {
          chainId: operation.chainId,
          data: operation.data,
          from: operation.from,
          fungibleTokenAmounts,
          operation: operation.operation,
          to: operation.to,
          status: operation.status as OperationStatus,
          transactionId: operation.transactionId,
        };
      });
    },
    updateTransactionStatus: (
      statuses: { status: OperationStatus; transactionId?: string }[],
      operationsId?: string,
    ) => {
      const transactionOperations = get().transactionOperationList;
      const index = _.findIndex(
        transactionOperations,
        (request) => request.operationsId == operationsId,
      );
      const operation = transactionOperations[index];

      console.log('updateTransactionStatus 1', operation, operationsId);
      if (statuses.length != operation?.operations?.length) {
        return;
      }

      console.log('updateTransactionStatus 2');

      operation.operations = operation?.operations?.map((operation, index) => {
        console.log(
          'updateTransactionStatus 3',
          statuses[index].status,
          statuses[index].transactionId,
        );
        return {
          ...operation,
          status: statuses[index].status,
          transactionId: statuses[index].transactionId,
        };
      });

      console.log('updateTransactionStatus 2', operation.operations);
      set({
        transactionOperationList: [
          ...transactionOperations.slice(0, index),
          operation,
          ...transactionOperations.slice(index + 1),
        ],
      });
    },
  }),
  {
    persist: {
      name: 'pendingRequestStore',
      version: 0,
    },
  },
);

export const usePendingRequestStore = create(pendingRequestStore);
