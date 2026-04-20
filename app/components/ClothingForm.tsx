import { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CATEGORIES } from '../constants/categories';
import { theme } from '../constants/theme';
import type { Category, Clothing } from '../types';
import { Chip } from './Chip';

export interface ClothingFormProps {
  value: Partial<Clothing>;
  onChange: (patch: Partial<Clothing>) => void;
  readOnly?: boolean;
  onImagePress?: () => void;
}

export function ClothingForm({ value, onChange, readOnly, onImagePress }: ClothingFormProps) {
  const colors = value.colors ?? [];
  const tags = value.tags ?? [];

  return (
    <View style={styles.container}>
      <ImagePreview uri={value.imageUri} onPress={readOnly ? undefined : onImagePress} />

      <Section label="카테고리">
        <View style={styles.chipRow}>
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={c}
              selected={value.category === c}
              onPress={readOnly ? undefined : () => onChange({ category: c as Category })}
              disabled={readOnly}
            />
          ))}
        </View>
      </Section>

      <Section label="색상">
        <ChipInput
          items={colors}
          onChange={(next) => onChange({ colors: next })}
          placeholder="예: 블랙"
          readOnly={readOnly}
        />
      </Section>

      <Section label="소재">
        <TextInput
          value={value.material ?? ''}
          onChangeText={(t) => onChange({ material: t })}
          placeholder="예: 면, 데님, 울"
          placeholderTextColor={theme.muted}
          editable={!readOnly}
          style={[styles.input, readOnly && styles.inputReadOnly]}
        />
      </Section>

      <Section label="태그">
        <ChipInput
          items={tags}
          onChange={(next) => onChange({ tags: next })}
          placeholder="예: 가을, 출근룩"
          readOnly={readOnly}
        />
      </Section>
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ImagePreview({ uri, onPress }: { uri?: string; onPress?: () => void }) {
  const [failed, setFailed] = useState(false);
  const show = uri && !failed;
  const Wrapper: React.ComponentType<{ children: React.ReactNode }> = onPress
    ? ({ children }) => (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [styles.imageBox, pressed && styles.pressed]}
        >
          {children}
        </Pressable>
      )
    : ({ children }) => <View style={styles.imageBox}>{children}</View>;

  return (
    <Wrapper>
      {show ? (
        <Image source={{ uri }} style={styles.image} onError={() => setFailed(true)} />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderText}>
            {onPress ? '사진 선택' : '사진 없음'}
          </Text>
        </View>
      )}
    </Wrapper>
  );
}

function ChipInput({
  items,
  onChange,
  placeholder,
  readOnly,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    if (items.includes(v)) {
      setDraft('');
      return;
    }
    onChange([...items, v]);
    setDraft('');
  };

  const remove = (v: string) => {
    onChange(items.filter((x) => x !== v));
  };

  return (
    <View>
      <View style={styles.chipRow}>
        {items.map((item) => (
          <Chip
            key={item}
            label={readOnly ? item : `${item}  ×`}
            selected
            onPress={readOnly ? undefined : () => remove(item)}
            disabled={readOnly}
          />
        ))}
      </View>
      {!readOnly && (
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={commit}
          onEndEditing={commit}
          blurOnSubmit={false}
          returnKeyType="done"
          placeholder={placeholder}
          placeholderTextColor={theme.muted}
          style={styles.input}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  section: { gap: 8 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: theme.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.text,
    fontSize: 15,
    backgroundColor: theme.bg,
  },
  inputReadOnly: { backgroundColor: '#F4F4F4', color: theme.muted },
  imageBox: {
    aspectRatio: 1,
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
    backgroundColor: '#F4F4F4',
  },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: { color: theme.muted, fontSize: 14 },
  pressed: { opacity: 0.85 },
});
