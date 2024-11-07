import { ChainId } from '../types/chains';

export const proxyRpcEndpoint = (endpoint: string, chainId: ChainId) => {
  // if (
  //   endpoint !== 'http://127.0.0.1:8545' &&
  //   endpoint !== 'http://localhost:8545' &&
  //   endpoint !== 'https://ethereum-holesky-rpc.publicnode.com'
  // ) {
  //   return `${process.env.RPC_PROXY_BASE_URL}/${chainId}/${
  //     process.env.RPC_PROXY_API_KEY
  //   }?custom_rpc=${encodeURIComponent(endpoint)}`;
  // }

  if (chainId == ChainId.holesky) {
    // return 'https://ethereum-holesky-rpc.publicnode.com';
    return 'https://ethereum-holesky.core.chainstack.com/3869a6437a482a0d980d76b40cba3d72';
  }

  return endpoint;
};
