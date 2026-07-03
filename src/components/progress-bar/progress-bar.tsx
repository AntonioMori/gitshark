import './styles.css';

import NProgress from 'nprogress';
import { useEffect } from 'react';

// ----------------------------------------------------------------------

export function ProgressBar() {
  useEffect(() => {
    NProgress.configure({ showSpinner: false });
    return () => {
      NProgress.done();
    };
  }, []);

  return null;
}
