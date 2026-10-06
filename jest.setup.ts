// Setup for the screen and component tests (Jest + jest-expo + React Native Testing Library).
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// The theme comes from the app state (the person's choice); component tests use the light palette.
jest.mock('@/hooks/use-theme', () => {
  const { Colors } = jest.requireActual('@/constants/theme');
  return { useTheme: () => Colors, useEstaEscuro: () => false };
});

// No test may reach the shared Supabase project: without this, a `.env` with the real URL would build a live client.
// A test that needs the client mocks it itself (its own `jest.mock` wins over this one).
jest.mock('@/lib/supabase', () => ({ supabase: null }));

// Reanimated 4 and Worklets need their native runtime; the libraries ship mocks for tests.
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => {
  const mock = jest.requireActual('react-native-reanimated/mock');
  // The shipped mock lags behind the library: fill in what the app uses and the mock does not have.
  return { ...mock, useReducedMotion: () => false };
});
