import { apiFetch } from './client';

export type AccessorySlot = 'HAT' | 'FACE' | 'BACKGROUND';

export interface ShopItem {
  id: string;
  key: string;
  name: string;
  slot: AccessorySlot;
  price: number;
  owned: boolean;
}

export interface EquippedAccessory {
  itemId: string;
  slot: AccessorySlot;
  key: string;
}

export async function getShopItems(): Promise<ShopItem[]> {
  const res = await apiFetch('/api/shop/items');
  if (!res.ok) throw new Error('상점 목록을 불러오지 못했어요');
  return res.json();
}

export async function purchaseItem(itemId: string): Promise<void> {
  const res = await apiFetch('/api/shop/purchase', {
    method: 'POST',
    body: JSON.stringify({ itemId }),
  });
  if (!res.ok) throw new Error('구매하지 못했어요');
}

export async function equipItem(itemId: string, equipped: boolean): Promise<void> {
  const res = await apiFetch('/api/shop/equip', {
    method: 'PATCH',
    body: JSON.stringify({ itemId, equipped }),
  });
  if (!res.ok) throw new Error('처리하지 못했어요');
}

export async function getMyAccessories(): Promise<EquippedAccessory[]> {
  const res = await apiFetch('/api/shop/my-accessories');
  if (!res.ok) throw new Error('악세서리 정보를 불러오지 못했어요');
  return res.json();
}
