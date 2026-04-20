import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../constants/theme';

export default function PersonCameraScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>전신 사진 촬영 (Phase 6)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg },
  text: { color: theme.muted },
});
