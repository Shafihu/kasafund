import { useAuthStore } from '@/stores/useAuthStore';
import { Redirect, Stack } from 'expo-router';
import 'react-native-reanimated';


export default function AuthLayout() {

  const isAuthenticated = useAuthStore(
    (state) => state.isAuthenticated
  );

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return (
      <Stack>
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      </Stack>
  );
}
