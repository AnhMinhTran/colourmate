import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { ColourPoint } from '@/src/colour/models/colourPoint';
import { SqliteColourPointRepository } from '@/src/colour/repositories/sqliteColourPointRepository';

export default function ColourPointScreen() {
  const db = useSQLiteContext();
  const repository = useMemo(() => new SqliteColourPointRepository(db), [db]);

  const [colours, setColours] = useState<ColourPoint[]>([]);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [r, setR] = useState('');
  const [g, setG] = useState('');
  const [b, setB] = useState('');
  const [tag, setTag] = useState('');

  /**
   * Loads all colour points from the database and updates state.
   * @throws If the database query fails
   */
  const loadColours = useCallback(async () => {
    const all = await repository.findAll();
    setColours(all);
  }, [repository]);

  useEffect(() => {
    loadColours();
  }, [loadColours]);

  /**
   * Validates RGB input, creates a ColourPoint, persists it, and refreshes the list.
   * Clears the form on success. Shows an alert on validation or database errors.
   */
  const handleAdd = async () => {
    try {
      const rVal = parseInt(r, 10);
      const gVal = parseInt(g, 10);
      const bVal = parseInt(b, 10);

      if ([rVal, gVal, bVal].some((v) => isNaN(v) || v < 0 || v > 255)) {
        Alert.alert('Invalid RGB', 'Each RGB value must be an integer between 0 and 255.');
        return;
      }

      const tags = tag
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const point = ColourPoint.create({
        name,
        brand,
        rgb: { r: rVal, g: gVal, b: bVal },
        tag: tags,
      });

      await repository.create(point);
      setName('');
      setBrand('');
      setR('');
      setG('');
      setB('');
      setTag('');
      await loadColours();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Error', message);
    }
  };

  /**
   * Deletes a colour point by id and refreshes the list.
   * @param id - The unique identifier of the colour point to remove
   */
  const handleDelete = async (id: string) => {
    await repository.delete(id);
    await loadColours();
  };

  /**
   * Renders a single colour point row with a colour swatch, details, and delete button.
   * @param item - The ColourPoint to render
   */
  const renderItem = ({ item }: { item: ColourPoint }) => {
    const bgColor = `rgb(${item.rgb.r}, ${item.rgb.g}, ${item.rgb.b})`;
    return (
      <View style={styles.row}>
        <View style={[styles.swatch, { backgroundColor: bgColor }]} />
        <View style={styles.rowInfo}>
          <Text style={styles.rowName}>{item.name}</Text>
          <Text style={styles.rowDetail}>{item.brand}</Text>
          <Text style={styles.rowDetail}>
            RGB({item.rgb.r}, {item.rgb.g}, {item.rgb.b})
          </Text>
          <Text style={styles.rowDetail}>
            XYZ({item.coordinate.x.toFixed(3)}, {item.coordinate.y.toFixed(3)},{' '}
            {item.coordinate.z.toFixed(3)})
          </Text>
          {item.tag.length > 0 && (
            <Text style={styles.rowDetail}>Tags: {item.tag.join(', ')}</Text>
          )}
        </View>
        <Pressable onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
          <Text style={styles.deleteTxt}>Delete</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>ColourPoint Test</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Name"
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Brand"
          placeholderTextColor="#999"
          value={brand}
          onChangeText={setBrand}
        />
        <View style={styles.rgbRow}>
          <TextInput
            style={[styles.input, styles.rgbInput]}
            placeholder="R"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={r}
            onChangeText={setR}
          />
          <TextInput
            style={[styles.input, styles.rgbInput]}
            placeholder="G"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={g}
            onChangeText={setG}
          />
          <TextInput
            style={[styles.input, styles.rgbInput]}
            placeholder="B"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={b}
            onChangeText={setB}
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Tags (comma-separated)"
          placeholderTextColor="#999"
          value={tag}
          onChangeText={setTag}
        />
        <Pressable style={styles.addBtn} onPress={handleAdd}>
          <Text style={styles.addBtnText}>Add Colour</Text>
        </Pressable>
      </View>

      <FlatList
        data={colours}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        style={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No colours saved yet.</Text>}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  form: {
    marginBottom: 16,
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  rgbRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rgbInput: {
    flex: 1,
  },
  addBtn: {
    backgroundColor: '#4A90D9',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  addBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  rowInfo: {
    flex: 1,
    marginLeft: 12,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowDetail: {
    fontSize: 12,
    color: '#666',
  },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  deleteTxt: {
    color: '#E44',
    fontWeight: '600',
  },
  empty: {
    textAlign: 'center',
    color: '#999',
    marginTop: 32,
  },
});
