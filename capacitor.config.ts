import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'eu.centjes.app',
  appName: 'Centjes',
  webDir: 'public',
  server: {
    url: 'https://centjes.eu',
    allowNavigation: [
      'centjes.eu',
      '*.centjes.eu',
      'accounts.google.com',
      '*.supabase.co',
    ],
  },
  ios: {
    backgroundColor: '#000000',
    contentInset: 'automatic',
    scheme: 'centjes',
  },
  plugins: {
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#000000',
    },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#000000',
      showSpinner: false,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
