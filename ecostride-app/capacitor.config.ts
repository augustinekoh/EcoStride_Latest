import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ecostride.app',
  appName: 'EcoStride',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    useLegacyBridge: true
  },
  server: {
    cleartext: false,
    androidScheme: 'https'
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound']
    }
  }
};

export default config;
