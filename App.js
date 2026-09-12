[9/12/2026 9:38 AM] Vp: import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';

import { auth } from './firebase';
import {
  initDatabase,
  syncCloudToLocal,
  syncLocalToCloud,
} from './database/db';

import LoginScreen from './screens/LoginScreen';

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
  const [databaseReady, setDatabaseReady] = useState(false);
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  // Initialize local database
  useEffect(() => {
    initDatabase()
      .then(() => {
        setDatabaseReady(true);
      })
      .catch((e) => {
        setError(e?.message || 'Unable to open database.');
      });
  }, []);

  // Watch Firebase login state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setCheckingAuth(false);

      if (!currentUser || !databaseReady) {
        return;
      }

      // Synchronize cloud and local database
      try {
        setSyncing(true);

        // Cloud data gets priority first.
        // If the cloud is empty, local data remains untouched.
        await syncCloudToLocal();

        // Upload local data.
        // This is useful for the first device that already has
        // the library stored locally.
        await syncLocalToCloud();
      } catch (e) {
        console.log('Cloud sync warning:', e);
      } finally {
        setSyncing(false);
      }
    });

    return unsubscribe;
  }, [databaseReady]);

  // Database error
  if (error) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
          <Text style={styles.errorTitle}>Database Error</Text>
          <Text style={styles.errorText}>{error}</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // Initial loading
  if (!databaseReady || checkingAuth) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
          <ActivityIndicator size="large" color={COLORS.navy} />

          <Text style={styles.loadingText}>
            Loading Brothers Vayanasala…
          </Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <LoginScreen />
      </SafeAreaProvider>
    );
  }

  // Logged in + synchronizing
  if (syncing) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
          <ActivityIndicator size="large" color={COLORS.navy} />

          <Text style={styles.syncTitle}>
            Syncing library…
          </Text>

          <Text style={styles.syncText}>
            Connecting Brothers Vayanasala to the cloud
          </Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }
[9/12/2026 9:38 AM] Vp: return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar
          style="dark"
          backgroundColor={COLORS.bg}
          translucent={false}
        />

        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,

            tabBarActiveTintColor: COLORS.navy,
            tabBarInactiveTintColor: '#9CA3AF',

            tabBarLabelStyle: {
              fontSize: 9,
              fontWeight: '600',
              marginBottom: 2,
            },

            tabBarStyle: {
              height: 62,
              paddingTop: 4,
              paddingBottom: 5,
              backgroundColor: '#FFFFFF',
              borderTopColor: COLORS.border,
              elevation: 8,
            },

            tabBarItemStyle: {
              flex: 1,
              minWidth: 48,
            },

            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name={ICONS[route.name]}
                size={Math.min(size, 22)}
                color={color}
              />
            ),
          })}
        >
          <Tab.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{ tabBarLabel: 'Home' }}
          />

          <Tab.Screen
            name="Add Book"
            component={AddBookScreen}
            options={{ tabBarLabel: 'Add' }}
          />

          <Tab.Screen
            name="Members"
            component={MembersScreen}
            options={{ tabBarLabel: 'Members' }}
          />

          <Tab.Screen
            name="Search"
            component={SearchScreen}
            options={{ tabBarLabel: 'Search' }}
          />

          <Tab.Screen
            name="Stock"
            component={StockViewScreen}
            options={{ tabBarLabel: 'Stock' }}
          />

          <Tab.Screen
            name="Issue/Return"
            component={IssueReturnScreen}
            options={{ tabBarLabel: 'Issue' }}
          />

          <Tab.Screen
            name="Backup"
            component={BackupRestoreScreen}
            options={{ tabBarLabel: 'Backup' }}
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
    backgroundColor: '#FFFFFF',
    padding: 24,
  },

  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#B91C1C',
    marginBottom: 10,
  },

  errorText: {
    color: '#B91C1C',
    paddingHorizontal: 20,
    textAlign: 'center',
  },

  loadingText: {
    marginTop: 12,
    color: COLORS.textMuted,
    fontSize: 15,
  },

  syncTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.navy,
  },

  syncText: {
    marginTop: 8,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
