import React, { useEffect, useState } from 'react';

import { i18n } from '~/core/languages';
import { useCurrentAddressStore, usePendingRequestStore } from '~/core/state';
import { Box, Button, Inline, Text, ThemeProvider } from '~/design-system';
import { Rows } from '~/design-system/components/Rows/Rows';
import { accentColorAsHsl } from '~/design-system/styles/core.css';
import { RainbowError, logger } from '~/logger';

import { FlyingRainbows } from '../../components/FlyingRainbows/FlyingRainbows';
import { LogoWithLetters } from '../../components/LogoWithLetters/LogoWithLetters';
import { Spinner } from '../../components/Spinner/Spinner';
import * as wallet from '../../handlers/wallet';
import { useRainbowNavigate } from '../../hooks/useRainbowNavigate';
import { ROUTES } from '../../urls';

import { OnboardBeforeConnectSheet } from './OnboardBeforeConnectSheet';
export function Welcome() {
  const navigate = useRainbowNavigate();
  const [loading, setLoading] = useState(false);
  const { pendingRequests } = usePendingRequestStore();
  const [showOnboardBeforeConnectSheet, setShowOnboardBeforeConnectSheet] =
    useState(!!pendingRequests.length);

  useEffect(() => {
    const wipeIncompleteWallet = async () => {
      const { hasVault, passwordSet } = await wallet.getStatus();
      if (hasVault && !passwordSet) {
        wallet.wipe('');
      }
    };
    wipeIncompleteWallet();
  }, []);

  const { setCurrentAddress } = useCurrentAddressStore();

  const handleImportWalletClick = React.useCallback(async () => {
    navigate(ROUTES.IMPORT_OR_CONNECT);
  }, [navigate]);

  const handleCreateNewWalletClick = React.useCallback(async () => {
    setLoading(true);
    try {
      const newWalletAddress = await wallet.create();
      setCurrentAddress(newWalletAddress);
      navigate(ROUTES.SEED_BACKUP_PROMPT);
    } catch (e) {
      logger.info('Onboarding error: creating new wallet failed');
      logger.error(e as RainbowError);
      setLoading(false);
    }
  }, [navigate, setCurrentAddress]);

  return (
    <>
      <OnboardBeforeConnectSheet
        show={showOnboardBeforeConnectSheet}
        onClick={() => setShowOnboardBeforeConnectSheet(false)}
      />
      <FlyingRainbows>
        <Box
          width="full"
          style={{ zIndex: 1, paddingTop: 127 }}
          background="transparent"
        >
          <Box
            width="full"
            display="flex"
            justifyContent="center"
            paddingBottom="4px"
          >
            <LogoWithLetters color="label" />
          </Box>
          <Box
            width="full"
            justifyContent="center"
            alignItems="center"
            display="flex"
            style={{
              height: '21px',
            }}
          >
            <Text
              align="center"
              color="labelTertiary"
              size="16pt"
              weight="bold"
            >
              {i18n.t('welcome.subtitle')}
            </Text>
          </Box>
          <Box width="full" style={{ marginTop: '226px' }}>
            <Rows alignVertical="top" space="20px">
              <Rows alignVertical="top" space="10px">
                {loading ? (
                  <Button
                    color="fill"
                    height="44px"
                    variant="flat"
                    width="full"
                    symbol="arrow.right"
                    symbolSide="right"
                    blur="26px"
                    onClick={handleCreateNewWalletClick}
                    testId="create-wallet-button"
                  >
                    <Inline space="8px" alignVertical="center">
                      <Text color="label" size="16pt" weight="bold">
                        {i18n.t('welcome.create_wallet')}
                      </Text>
                      <Spinner size={16} color="label" />
                    </Inline>
                  </Button>
                ) : (
                  <Button
                    color="fill"
                    height="44px"
                    variant="flat"
                    width="full"
                    symbol="arrow.right"
                    symbolSide="right"
                    blur="26px"
                    onClick={handleCreateNewWalletClick}
                    testId="create-wallet-button"
                  >
                    {i18n.t('welcome.create_wallet')}
                  </Button>
                )}
                <ThemeProvider theme="dark">
                  <Button
                    color="surfaceSecondaryElevated"
                    height="44px"
                    variant="flat"
                    width="full"
                    onClick={handleImportWalletClick}
                    testId="import-wallet-button"
                  >
                    {i18n.t('welcome.import_wallet')}
                  </Button>
                </ThemeProvider>
              </Rows>
              <Box display="flex" style={{ width: '210px', margin: 'auto' }}>
                <Text
                  align="center"
                  color="labelTertiary"
                  size="12pt"
                  weight="regular"
                  as="p"
                >
                  {i18n.t('welcome.disclaimer_tos')}&nbsp;
                  <a
                    href="https://rainbow.me/terms-of-use"
                    target="_blank"
                    style={{ color: accentColorAsHsl }}
                    rel="noreferrer"
                  >
                    {i18n.t('welcome.disclaimer_tos_link')}
                  </a>
                </Text>
              </Box>
            </Rows>
          </Box>
        </Box>
      </FlyingRainbows>
    </>
  );
}
