import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

const map = {
  high:   { bg: COLORS.redBg,   color: COLORS.red,   label: 'High Priority'   },
  medium: { bg: COLORS.amberBg, color: COLORS.amber, label: 'Medium Priority' },
  low:    { bg: COLORS.border,  color: COLORS.text3, label: 'Low Priority'    },
};

export default function PriorityBadge({ priority }) {
  const p = map[priority] || map.low;
  return (
    <View style={[styles.badge, { backgroundColor: p.bg }]}>
      <View style={[styles.dot, { backgroundColor: p.color }]} />
      <Text style={[styles.text, { color: p.color }]}>{p.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  dot:   { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  text:  { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
});
