import { StyleSheet, Text, View } from 'react-native';

export default function FittingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>피팅</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600' },
});
