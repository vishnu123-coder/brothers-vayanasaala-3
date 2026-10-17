import React from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import ScreenHeader from '../utils/ScreenHeader';
import { COLORS, useLayout } from '../utils/theme';

// Standard screen frame: header + body centred at a readable width, so the
// layout looks right on small phones, big phones and tablets alike.
export default function Screen({ children, keyboard = false, ...headerProps }) {
  const { contentMax } = useLayout();
  const body = <View style={[styles.body, { maxWidth: contentMax }]}>{children}</View>;
  return (
    <View style={styles.root}>
      <ScreenHeader {...headerProps} />
      {keyboard && Platform.OS === 'ios' ? (
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  body: { flex: 1, width: '100%', alignSelf: 'center' },
});
