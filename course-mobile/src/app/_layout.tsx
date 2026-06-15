import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { theme } from '@/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'courseneo' }} />
        <Stack.Screen name="upload" options={{ title: 'Upload a course' }} />
        <Stack.Screen name="courses" options={{ title: 'Courses' }} />
        <Stack.Screen name="course" options={{ title: 'Course' }} />
        <Stack.Screen name="status" options={{ title: 'Connection' }} />
      </Stack>
    </>
  );
}
