import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShopItem, equipItem, getShopItems, purchaseItem } from '../api/shop';
import { getGrowth } from '../api/growth';
import KkumiView from '../components/KkumiView';
import { colors, fonts } from '../theme';

const BG_PREVIEW_COLOR: Record<string, string> = {
  star_bg: '#FFF6E0',
  rainbow_bg: '#F8F0FA',
};

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
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }} edges={['top']}>
        <Text testID="shop-error" style={{ fontFamily: fonts.body, color: colors.fail, marginBottom: 10 }}>
          {error}
        </Text>
        <TouchableOpacity testID="shop-retry" onPress={load}>
          <Text style={{ fontFamily: fonts.heading, color: colors.green }}>다시 시도</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ fontFamily: fonts.heading, fontSize: 26, color: colors.ink }}>상점</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.goldTint, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 }}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.gold }} />
          <Text testID="shop-points" style={{ fontFamily: fonts.heading, color: colors.goldText }}>{`보유 포인트: ${points}P`}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {items.map((item) => (
          <View
            key={item.id}
            style={{ width: '47%', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 12, alignItems: 'center', gap: 8 }}
          >
            <View
              style={{
                width: '100%',
                height: 96,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                backgroundColor: item.slot === 'BACKGROUND' ? BG_PREVIEW_COLOR[item.key] ?? colors.card : '#F5EFE4',
              }}
            >
              {item.slot !== 'BACKGROUND' ? (
                <KkumiView
                  species="SPECIES_A"
                  stage={3}
                  size={76}
                  accessories={[{ slot: item.slot, key: item.key }]}
                />
              ) : null}
            </View>
            <Text style={{ fontFamily: fonts.heading, fontSize: 14, color: colors.ink }}>{`${item.name} (${item.price}P)`}</Text>
            {item.owned ? (
              <TouchableOpacity
                testID={`shop-equip-${item.id}`}
                onPress={() => handleEquip(item.id)}
                style={{ width: '100%', borderWidth: 1.5, borderColor: colors.green, borderRadius: 12, paddingVertical: 8, alignItems: 'center', backgroundColor: colors.greenTint }}
              >
                <Text style={{ fontFamily: fonts.heading, color: colors.greenDark, fontSize: 13 }}>장착</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                testID={`shop-buy-${item.id}`}
                onPress={() => handlePurchase(item.id)}
                style={{ width: '100%', borderRadius: 12, paddingVertical: 8, alignItems: 'center', backgroundColor: colors.gold }}
              >
                <Text style={{ fontFamily: fonts.heading, color: '#7A5A16', fontSize: 13 }}>구매</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}
