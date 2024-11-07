import { ReactNode } from 'react';

import { ParsedAsset, ParsedUserAsset } from '~/core/types/assets';
import {
  Box,
  Column,
  Columns,
  Inset,
  Row,
  Rows,
  TextOverflow,
} from '~/design-system';
import { Lens } from '~/design-system/components/Lens/Lens';
import { rowTransparentAccentHighlight } from '~/design-system/styles/rowTransparentAccentHighlight.css';

import { CoinIcon } from '../CoinIcon/CoinIcon';

function RowHighlightWrapper({ children }: { children: ReactNode }) {
  return (
    <Inset horizontal="8px">
      <Lens borderRadius="12px" forceAvatarColor>
        <Box borderRadius="12px" className={rowTransparentAccentHighlight}>
          {children}
        </Box>
      </Lens>
    </Inset>
  );
}

export function CoinRow({
  asset,
  fallbackText,
  topRow,
  bottomRow,
  testId,
  size,
  isParent,
}: {
  asset?: ParsedAsset | ParsedUserAsset;
  fallbackText?: string;
  topRow: ReactNode;
  bottomRow: ReactNode;
  testId?: string;
  size: number;
  isParent: boolean;
}) {
  return (
    <Box style={{ height: '52px' }} testId={testId}>
      <RowHighlightWrapper>
        <Inset horizontal="12px" vertical="8px">
          <Rows>
            <Row>
              <Columns alignVertical="center" space="8px">
                <Column width="content">
                  <CoinIcon
                    asset={asset}
                    fallbackText={fallbackText}
                    size={size}
                  />
                </Column>
                <Column width="content">
                  {!isParent && (
                    <Box paddingVertical="4px">
                      <TextOverflow size="12pt" weight="medium">
                        {asset?.chainName}
                      </TextOverflow>
                    </Box>
                  )}
                </Column>
                <Column>
                  <Rows>
                    <Row>{topRow}</Row>
                    <Row>{bottomRow}</Row>
                  </Rows>
                </Column>
              </Columns>
            </Row>
          </Rows>
        </Inset>
      </RowHighlightWrapper>
    </Box>
  );
}
