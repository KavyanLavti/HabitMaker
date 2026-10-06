import { Link } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>[SYSTEM] UNKNOWN ZONE</Text>
      <Link href="/today" style={styles.link}>RETURN TO DAILY QUEST</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background, padding: 20 },
  title: { fontFamily: Fonts.display, fontSize: 18, letterSpacing: 2, color: Colors.danger },
  link: { marginTop: 20, fontFamily: Fonts.displaySemi, fontSize: 13, letterSpacing: 2, color: Colors.system },
});
