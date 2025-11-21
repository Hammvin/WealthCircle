import { Platform } from 'react-native';

// Use expo-crypto instead of Node.js crypto
if (Platform.OS !== 'web') {
  // Remove or comment out the Node.js crypto import
  // const crypto = require('crypto');
  
  // Use expo-crypto for React Native
  const { getRandomBytes } = require('expo-crypto');
  
  // Polyfill crypto.getRandomValues using expo-crypto
  global.crypto = {
    getRandomValues: (array: any) => {
      const randomBytes = getRandomBytes(array.byteLength);
      new Uint8Array(array.buffer).set(randomBytes);
      return array;
    }
  } as any;
}