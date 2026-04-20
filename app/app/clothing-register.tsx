import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../constants/theme';

export default function ClothingRegisterScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>옷 등록 (Phase 5)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg },
  text: { color: theme.muted },
});
