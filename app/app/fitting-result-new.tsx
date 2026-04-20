import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../constants/theme';

export default function FittingResultNewScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>신규 피팅 결과 (Phase 6)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg },
  text: { color: theme.muted },
});
