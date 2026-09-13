import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

const BAR_MAX_HEIGHT = 110;
const BAR_MIN_HEIGHT = 3;

// data: [{ label: 'Mon', dayNum: 21, count: 4, isToday: false }, ...] — 7 entries, oldest first
export default function WeeklyRequestsChart({ data }) {
  const maxCount = Math.max(1, ...data.map(d => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Text style={s.title}>Requests — Last 7 Days</Text>
        <Text style={s.total}>{total} total</Text>
      </View>

      <View style={s.chartArea}>
        {data.map((d, i) => {
          const barHeight = d.count === 0
            ? BAR_MIN_HEIGHT
            : Math.max(BAR_MIN_HEIGHT, (d.count / maxCount) * BAR_MAX_HEIGHT);
          return (
            <View key={i} style={s.col}>
              <Text style={s.value}>{d.count}</Text>
              <View style={s.barTrack}>
                <View
                  style={[
                    s.bar,
                    {
                      height: barHeight,
                      backgroundColor: d.isToday ? COLORS.goldLight : COLORS.gold,
                    },
                  ]}
                />
              </View>
              <Text style={[s.dayLabel, d.isToday && s.dayLabelToday]}>{d.label}</Text>
              <Text style={s.dateLabel}>{d.dayNum}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card:          { backgroundColor: COLORS.bg2, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 16, marginBottom: 14 },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title:         { color: COLORS.gold, fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  total:         { color: COLORS.text2, fontSize: 11, fontWeight: '600' },
  chartArea:     { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  col:           { flex: 1, alignItems: 'center' },
  value:         { color: COLORS.text, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  barTrack:      { height: BAR_MAX_HEIGHT, justifyContent: 'flex-end', borderBottomWidth: 1, borderBottomColor: COLORS.border, width: '100%', alignItems: 'center' },
  bar:           { width: 20, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  dayLabel:      { color: COLORS.text3, fontSize: 10, fontWeight: '600', marginTop: 6, letterSpacing: 0.3 },
  dayLabelToday: { color: COLORS.gold },
  dateLabel:     { color: COLORS.text3, fontSize: 9, marginTop: 1 },
});
