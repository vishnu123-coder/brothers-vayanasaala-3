import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initDatabase } from './database/db';
import DashboardScreen from './screens/DashboardScreen';
import AddBookScreen from './screens/AddBookScreen';
import SearchScreen from './screens/SearchScreen';
import StockViewScreen from './screens/StockViewScreen';
import IssueReturnScreen from './screens/IssueReturnScreen';
import BackupRestoreScreen from './screens/BackupRestoreScreen';
import MembersScreen from './screens/MembersScreen';
import { COLORS } from './utils/theme';

const Tab = createBottomTabNavigator();

const ICONS = {
  Dashboard: 'home-outline',
  'Add Book': 'add-circle-outline',
  Search: 'search-outline',
  Stock: 'library-outline',
  'Issue/Return': 'repeat-outline',
  Backup: 'save-outline',
  Members: 'people-outline',
};

const LABELS = {
  Dashboard: 'Home',
  'Add Book': 'Add',
  Search: 'Search',
  Stock: 'Stock',
  'Issue/Return': 'Issue',
  Backup: 'Backup',
  Members: 'Members',
};

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    initDatabase()
      .then(() => setReady(true))
      .catch((e) => setError(e?.message || 'Unable to open database.'));
  }, []);

  if (error) {
    return (
      <SafeAreaProvider>
        <View style={styles.center}>
          <Text style={styles.errorText}>Database error: {error}</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.navy} />
          <Text style={styles.loadingText}>Loading Brothers Vayanasala…</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" backgroundColor={COLORS.bg} translucent={false} />
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: COLORS.navy,
            tabBarInactiveTintColor: '#8A94A3',
            tabBarLabel: LABELS[route.name],
            tabBarLabelStyle: { fontSize: 9, fontWeight: '600', marginBottom: 2 },
            tabBarItemStyle: { flex: 1, minWidth: 48 },
            tabBarStyle: {
              height: 62,
              paddingTop: 4,
              paddingBottom: 5,
              backgroundColor: '#FFFFFF',
              borderTopColor: COLORS.border,
              elevation: 8,
            },
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={ICONS[route.name]} size={Math.min(size, 22)} color={color} />
            ),
          })}
        >
          <Tab.Screen name="Dashboard" component={DashboardScreen} />
          <Tab.Screen name="Add Book" component={AddBookScreen} />
          <Tab.Screen name="Search" component={SearchScreen} />
          <Tab.Screen name="Stock" component={StockViewScreen} />
          <Tab.Screen name="Issue/Return" component={IssueReturnScreen} />
          <Tab.Screen name="Backup" component={BackupRestoreScreen} />
          <Tab.Screen
            name="Members"
            component={MembersScreen}
            options={{ tabBarButton: () => null }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    padding: 24,
  },
  errorText: { color: COLORS.danger, textAlign: 'center' },
  loadingText: { marginTop: 12, color: COLORS.textMuted },
});
