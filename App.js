import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import { initDatabase } from './database/db';
import DashboardScreen from './screens/DashboardScreen';
import SearchScreen from './screens/SearchScreen';
import StockViewScreen from './screens/StockViewScreen';
import IssueReturnScreen from './screens/IssueReturnScreen';
import MoreScreen from './screens/MoreScreen';
import AddBookScreen from './screens/AddBookScreen';
import MembersScreen from './screens/MembersScreen';
import BackupRestoreScreen from './screens/BackupRestoreScreen';
import { COLORS, TYPE } from './utils/theme';

// Respect the user's system font size, but stop extreme sizes from breaking
// layouts on any screen.
Text.defaultProps = { ...(Text.defaultProps || {}), maxFontSizeMultiplier: 1.3 };
TextInput.defaultProps = { ...(TextInput.defaultProps || {}), maxFontSizeMultiplier: 1.3 };

const Tab = createBottomTabNavigator();
const MoreStack = createNativeStackNavigator();

const TAB_ICONS = {
  Dashboard: ['home', 'home-outline'],
  Search: ['search', 'search-outline'],
  Stock: ['library', 'library-outline'],
  'Issue/Return': ['repeat', 'repeat-outline'],
  More: ['grid', 'grid-outline'],
};

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: COLORS.bg, primary: COLORS.navy },
};

function MoreNavigator() {
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <MoreStack.Screen name="MoreHome" component={MoreScreen} />
      <MoreStack.Screen name="Add Book" component={AddBookScreen} />
      <MoreStack.Screen name="Members" component={MembersScreen} />
      <MoreStack.Screen name="Backup" component={BackupRestoreScreen} />
    </MoreStack.Navigator>
  );
}

function Tabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: COLORS.navy,
        tabBarInactiveTintColor: '#7B8499',
        tabBarLabelStyle: { fontSize: 12, lineHeight: 16, fontWeight: '700', marginTop: 2 },
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: COLORS.border,
          height: 62 + insets.bottom,
          paddingTop: 7,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
        },
        tabBarIcon: ({ color, focused }) => {
          const [filled, outline] = TAB_ICONS[route.name];
          return <Ionicons name={focused ? filled : outline} size={25} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Stock" component={StockViewScreen} />
      <Tab.Screen name="Issue/Return" component={IssueReturnScreen} options={{ tabBarLabel: 'Issue' }} />
      <Tab.Screen name="More" component={MoreNavigator} />
    </Tab.Navigator>
  );
}

function Splash({ message, error }) {
  return (
    <View style={styles.splash}>
      <StatusBar style="light" />
      <Image source={require('./assets/logo.png')} style={styles.splashLogo} />
      <Text style={styles.splashTitle}>Brothers Vayanasala</Text>
      {error ? (
        <Text style={styles.splashError}>{error}</Text>
      ) : (
        <>
          <ActivityIndicator size="large" color={COLORS.amber} style={{ marginTop: 22 }} />
          <Text style={styles.splashMsg}>{message}</Text>
        </>
      )}
    </View>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // initDatabase never blocks on the network: if the phone is offline the
    // app still opens and works from its saved copy.
    initDatabase()
      .then(() => setReady(true))
      .catch((e) => setError(`Could not start: ${e.message}`));
  }, []);

  return (
    <SafeAreaProvider>
      {error || !ready ? (
        <Splash message="Opening your library…" error={error} />
      ) : (
        <NavigationContainer theme={navTheme}>
          <StatusBar style="light" />
          <Tabs />
        </NavigationContainer>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: COLORS.navy, justifyContent: 'center', alignItems: 'center', padding: 24 },
  splashLogo: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  splashTitle: { ...TYPE.title, color: '#fff', marginTop: 18 },
  splashMsg: { ...TYPE.body, color: '#C9D6E5', marginTop: 10 },
  splashError: { ...TYPE.body, color: '#FCA5A5', marginTop: 16, textAlign: 'center' },
});
