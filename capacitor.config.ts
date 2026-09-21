import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'vn.edu.marketsurvey',
  appName: 'Market Survey',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_survey',
      iconColor: '#2563EB'
    }
  }
};

export default config;
