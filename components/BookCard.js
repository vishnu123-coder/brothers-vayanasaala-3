import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { categoryColor, categoryLabel } from '../database/constants';
import { COLORS, RADIUS, SHADOW, TYPE } from '../utils/theme';

function BookCard({ book, onDelete, onPress }) {
  const color = categoryColor(book.category_code);
  const issued = book.status === 'issued';
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper activeOpacity={0.85} onPress={onPress ? () => onPress(book) : undefined} style={styles.card}>
      <View style={[styles.stripe, { backgroundColor: color }]} />
      <View style={styles.body}>
        <View style={styles.top}>
          <View style={[styles.idBadge, { backgroundColor: color + '1A' }]}>
            <Text style={[styles.idText, { color }]}>#{book.book_id}</Text>
          </View>
          <View style={[styles.pill, { backgroundColor: issued ? COLORS.dangerBg : COLORS.successBg }]}>
            <View style={[styles.dot, { backgroundColor: issued ? COLORS.danger : COLORS.success }]} />
            <Text style={[styles.pillText, { color: issued ? COLORS.danger : COLORS.success }]}>
              {issued ? 'Issued' : 'Available'}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>{book.book_name}</Text>
        <Text style={styles.author}>{book.author_name || 'Unknown author'}</Text>

        <View style={styles.tags}>
          <View style={[styles.tag, { backgroundColor: color + '14' }]}>
            <Text style={[styles.tagText, { color }]}>
              {categoryLabel(book.category_code)} · {book.category_code}-{book.category_no}
            </Text>
          </View>
          {book.category_type ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{book.category_type}</Text>
            </View>
          ) : null}
          {book.cost ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>₹{book.cost}</Text>
            </View>
          ) : null}
        </View>

        {book.publication_name ? (
          <Text style={styles.publisher}>
            <Text style={styles.publisherLabel}>Publisher: </Text>
            {book.publication_name}
          </Text>
        ) : null}

        {onDelete ? (
          <TouchableOpacity style={styles.deleteRow} onPress={() => onDelete(book)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 20 }}>
            <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
            <Text style={styles.deleteText}>Delete book</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Wrapper>
  );
}

export default React.memo(BookCard);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    marginBottom: 10,
    overflow: 'hidden',
    ...SHADOW,
  },
  stripe: { width: 6 },
  body: { flex: 1, padding: 14 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  idBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  idText: { ...TYPE.smallStrong, fontWeight: '800' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { ...TYPE.caption },
  title: { ...TYPE.h3, color: COLORS.text, marginTop: 10 },
  author: { ...TYPE.body, color: COLORS.textSecondary, marginTop: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { backgroundColor: COLORS.bg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  tagText: { ...TYPE.caption, color: COLORS.navy },
  publisher: { ...TYPE.small, color: COLORS.textMuted, marginTop: 10 },
  publisherLabel: { fontWeight: '700' },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    width: '100%',
  },
  deleteText: { ...TYPE.smallStrong, color: COLORS.danger },
});
