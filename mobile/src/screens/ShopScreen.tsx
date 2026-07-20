import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { ShopItem, equipItem, getShopItems, purchaseItem } from '../api/shop';
import { getGrowth } from '../api/growth';

export default function ShopScreen() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [points, setPoints] = useState(0);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [itemList, growth] = await Promise.all([getShopItems(), getGrowth()]);
      setItems(itemList);
      setPoints(growth.points);
    } catch {
      setError('상점 정보를 불러오지 못했어요');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePurchase(itemId: string) {
    try {
      await purchaseItem(itemId);
      await load();
    } catch {
      setError('구매하지 못했어요');
    }
  }

  async function handleEquip(itemId: string) {
    try {
      await equipItem(itemId, true);
      await load();
    } catch {
      setError('장착하지 못했어요');
    }
  }

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text testID="shop-error">{error}</Text>
        <TouchableOpacity testID="shop-retry" onPress={load}>
          <Text>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text testID="shop-points">{`보유 포인트: ${points}P`}</Text>
      {items.map((item) => (
        <View key={item.id}>
          <Text>{`${item.name} (${item.price}P)`}</Text>
          {item.owned ? (
            <TouchableOpacity testID={`shop-equip-${item.id}`} onPress={() => handleEquip(item.id)}>
              <Text>장착</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity testID={`shop-buy-${item.id}`} onPress={() => handlePurchase(item.id)}>
              <Text>구매</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </ScrollView>
  );
}
