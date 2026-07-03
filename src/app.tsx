import 'src/global.css';

import { themeConfig, ThemeProvider } from 'src/theme';

import { MotionLazy } from 'src/components/animate/motion-lazy';

import { GitSharkLayout } from 'src/layouts/gitshark-layout';

// ----------------------------------------------------------------------

export default function App() {
  return (
    <ThemeProvider defaultMode={themeConfig.defaultMode}>
      <MotionLazy>
        <GitSharkLayout />
      </MotionLazy>
    </ThemeProvider>
  );
}
