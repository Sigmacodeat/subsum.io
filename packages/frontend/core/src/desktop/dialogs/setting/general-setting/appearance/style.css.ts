import { style } from '@vanilla-extract/css';
export const settingWrapper = style({
  flexGrow: 1,
  display: 'flex',
  justifyContent: 'flex-end',
  minWidth: '150px',
  maxWidth: '250px',
});

export const themeSettingsPanel = style({
  width: '100%',
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: 14,
  '@media': {
    '(max-width: 960px)': {
      justifyContent: 'flex-start',
    },
  },
});

