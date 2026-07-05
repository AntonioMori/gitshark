import type { ThemeOptions } from './types';

import { createPaletteChannel } from 'minimal-shared/utils';

// ----------------------------------------------------------------------

export const themeOverrides: ThemeOptions = {
  colorSchemes: {
    light: {
      palette: {
        primary: createPaletteChannel({
          lighter: '#C8FAD6',
          light: '#5BE49B',
          main: '#00A76F',
          dark: '#007867',
          darker: '#004B50',
          contrastText: '#FFFFFF',
        }),
      },
    },
    dark: {
      palette: {
        primary: createPaletteChannel({
          lighter: '#C8FAD6',
          light: '#5BE49B',
          main: '#00A76F',
          dark: '#007867',
          darker: '#004B50',
          contrastText: '#FFFFFF',
        }),
      },
    },
  },
};
