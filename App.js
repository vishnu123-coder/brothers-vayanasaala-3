import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

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
  Dashboard: 'home',
  'Add Book': 'add-circle',
  Members: 'people',
  Search: 'search',
  Stock: 'library',
  'Issue/Return': 'repeat',
  Backup: 'save',
};

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    initDatabase()
      .then(() => setReady(true))
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.center} edges={['top']}>
          <Text style={styles.errorText}>Database error: {error}</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!ready) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.center} edges={['top']}>
          <ActivityIndicator size="large" color={COLORS.navy} />
          <Text style={{ marginTop: 12, color: COLORS.textMuted }}>Loading Brothers Vayanasala…</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: COLORS.navy,
            tabBarInactiveTintColor: '#9CA3AF',
            tabBarLabelStyle: { fontSize: 9 },
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={ICONS[route.name]} size={size - 4} color={color} />
            ),
          })}
        >
          <Tab.Screen name="Dashboard" component={DashboardScreen} />
          <Tab.Screen name="Add Book" component={AddBookScreen} />
          <Tab.Screen name="Members" component={MembersScreen} />
          <Tab.Screen name="Search" component={SearchScreen} />
          <Tab.Screen name="Stock" component={StockViewScreen} />
          <Tab.Screen name="Issue/Return" component={IssueReturnScreen} />
          <Tab.Screen name="Backup" component={BackupRestoreScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  errorText: { color: 'red', padding: 20, textAlign: 'center' },
});
