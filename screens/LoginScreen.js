[9/12/2026 9:41 AM] Vp: import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';

import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { COLORS } from '../utils/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    try {
      setLoading(true);

      await signInWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

      // App.js will automatically detect
      // the successful login and open the library.
    } catch (e) {
      let message = 'Unable to sign in. Please check your details.';

      if (e?.code === 'auth/invalid-credential') {
        message = 'Incorrect email or password.';
      } else if (e?.code === 'auth/user-not-found') {
        message = 'No account found with this email.';
      } else if (e?.code === 'auth/wrong-password') {
        message = 'Incorrect password.';
      } else if (e?.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else if (e?.code === 'auth/too-many-requests') {
        message = 'Too many attempts. Please try again later.';
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>

          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>BV</Text>
          </View>

          <Text style={styles.title}>
            Brothers Vayanasala
          </Text>

          <Text style={styles.subtitle}>
            Library Management System
          </Text>

          <Text style={styles.loginTitle}>
            Staff Login
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            editable={!loading}
            onSubmitEditing={handleLogin}
          />

          {error ? (
            <Text style={styles.error}>
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[
              styles.button,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                Sign In
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.footer}>
            Secure library access
          </Text>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F9',
  },
[9/12/2026 9:41 AM] Vp: scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 26,
    elevation: 5,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },

  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.navy,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },

  logoText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },

  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.navy,
    textAlign: 'center',
  },

  subtitle: {
    marginTop: 5,
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },

  loginTitle: {
    marginTop: 30,
    marginBottom: 16,
    fontSize: 19,
    fontWeight: '700',
    color: '#1F2937',
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 15,
    color: '#111827',
    marginBottom: 13,
    backgroundColor: '#FAFAFA',
  },

  error: {
    color: '#DC2626',
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 19,
  },

  button: {
    height: 52,
    borderRadius: 12,
    backgroundColor: COLORS.navy,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  footer: {
    textAlign: 'center',
    marginTop: 18,
    color: '#9CA3AF',
    fontSize: 12,
  },
});
