import React, { useCallback, useState } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getStockStats, getActiveIssues, CATEGORIES } from '../database/db';
import { COLORS, SPACING, RADIUS } from '../utils/theme';

export default function DashboardScreen({ navigation }) {
  const [stats, setStats] = useState({ total: 0, issued: 0, available: 0, byCategory: [] });
  const [dueSoon, setDueSoon] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const s = await getStockStats();
    setStats(s);
    const issues = await getActiveIssues();
    setDueSoon(issues.slice(0, 5));
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const catLabel = (code) => CATEGORIES.find((c) => c.code === code)?.label || code;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Brothers Vayanasala</Text>
          <Text style={styles.subtitle}>Read · Learn · Grow</Text>
        </View>
        <Image source={require('../assets/logo.png')} style={styles.logoImage} />
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Total Books" value={stats.total} icon="library" color={COLORS.navy} />
        <StatCard label="Issued" value={stats.issued} icon="swap-horizontal" color={COLORS.amberDark} />
        <StatCard label="Available" value={stats.available} icon="checkmark-circle" color={COLORS.success} />
      </View>

      <View style={styles.quickActions}>
        <QuickAction icon="add-circle" label="Add Book" onPress={() => navigation.navigate('Add Book')} />
        <QuickAction icon="search" label="Search" onPress={() => navigation.navigate('Search')} />
        <QuickAction icon="list" label="Stock" onPress={() => navigation.navigate('Stock')} />
        <QuickAction icon="repeat" label="Issue/Return" onPress={() => navigation.navigate('Issue/Return')} />
        <QuickAction icon="save" label="Backup" onPress={() => navigation.navigate('Backup')} />
      </View>

      <Text style={styles.sectionTitle}>Books by Category</Text>
      <View style={styles.card}>
        {stats.byCategory.length === 0 && (
          <Text style={styles.emptyText}>No books added yet.</Text>
        )}
        {stats.byCategory.map((c) => (
          <View style={styles.categoryRow} key={c.category_code}>
            <Text style={styles.categoryLabel}>{catLabel(c.category_code)}</Text>
            <Text style={styles.categoryCount}>{c.c}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Due Soon</Text>
      <View style={styles.card}>
        {dueSoon.length === 0 && <Text style={styles.emptyText}>No active issues.</Text>}
        {dueSoon.map((issue) => (
          <View style={styles.dueRow} key={issue.id}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dueBook}>{issue.book_name}</Text>
              <Text style={styles.dueMember}>Member: {issue.member_id}</Text>
            </View>
            <Text style={styles.dueDate}>{issue.due_date}</Text>
          </View>
        ))}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={styles.quickIconWrap}>
        <Ionicons name={icon} size={22} color={COLORS.navy} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: SPACING.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    marginTop: SPACING.sm,
  },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.navy },
  subtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  logoImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginLeft: SPACING.sm,
  },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'flex-start',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginTop: 6 },
  statLabel: { fontSize: 12, color: COLORS.textMuted },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  quickAction: { width: '18%', alignItems: 'center' },
  quickIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    elevation: 1,
  },
  quickLabel: { fontSize: 11, color: COLORS.text, textAlign: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.navy, marginBottom: SPACING.sm },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    elevation: 1,
  },
  emptyText: { color: COLORS.textMuted, fontSize: 13 },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  categoryLabel: { color: COLORS.text, fontSize: 14 },
  categoryCount: { color: COLORS.navy, fontWeight: '700' },
  dueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dueBook: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  dueMember: { fontSize: 12, color: COLORS.textMuted },
  dueDate: { fontSize: 13, color: COLORS.amberDark, fontWeight: '700' },
});
