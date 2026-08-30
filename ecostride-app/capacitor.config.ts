import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ecostride.app',
  appName: 'EcoStride',
  webDir: 'dist',
  android: {
    useLegacyBridge: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound']
    }
  }
};

export default config;
