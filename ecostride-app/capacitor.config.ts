import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ecostride.app',
  appName: 'EcoStride',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    useLegacyBridge: true
  },
  server: {
    cleartext: true,
    androidScheme: 'http'
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound']
    }
  }
};

export default config;
