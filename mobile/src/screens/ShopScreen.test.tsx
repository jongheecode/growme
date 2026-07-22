import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as shopApi from '../api/shop';
import * as growthApi from '../api/growth';
import ShopScreen from './ShopScreen';

jest.mock('../api/shop');
jest.mock('../api/growth');

const items: shopApi.ShopItem[] = [
  { id: 'i1', key: 'ribbon', name: '리본', slot: 'HAT', price: 50, owned: false },
  { id: 'i2', key: 'round_glasses', name: '동그란 안경', slot: 'FACE', price: 80, owned: true },
];

beforeEach(() => {
  jest.clearAllMocks();
  (shopApi.getShopItems as jest.Mock).mockResolvedValue(items);
  (shopApi.purchaseItem as jest.Mock).mockResolvedValue(undefined);
  (shopApi.equipItem as jest.Mock).mockResolvedValue(undefined);
  (growthApi.getGrowth as jest.Mock).mockResolvedValue({
    totalXp: 60,
    species: 'SPECIES_A',
    stage: 1,
    xpIntoStage: 10,
    xpToNextStage: 100,
    personality: null,
    points: 100,
  });
});

describe('ShopScreen', () => {
  it('loads items and shows the point balance', async () => {
    render(<ShopScreen />);
    await waitFor(() => expect(screen.getByText(/리본/)).toBeTruthy());
    expect(screen.getByText(/100/)).toBeTruthy();
  });

  it('purchases an item and reloads', async () => {
    render(<ShopScreen />);
    await waitFor(() => expect(screen.getByTestId('shop-buy-i1')).toBeTruthy());

    fireEvent.press(screen.getByTestId('shop-buy-i1'));
    await waitFor(() => expect(shopApi.purchaseItem).toHaveBeenCalledWith('i1'));
  });

  it('shows an equip button only for owned items', async () => {
    render(<ShopScreen />);
    await waitFor(() => expect(screen.getByTestId('shop-equip-i2')).toBeTruthy());
    expect(screen.queryByTestId('shop-equip-i1')).toBeNull();
    expect(screen.queryByTestId('shop-buy-i2')).toBeNull();
  });

  it('equips an owned item', async () => {
    render(<ShopScreen />);
    await waitFor(() => expect(screen.getByTestId('shop-equip-i2')).toBeTruthy());

    fireEvent.press(screen.getByTestId('shop-equip-i2'));
    await waitFor(() => expect(shopApi.equipItem).toHaveBeenCalledWith('i2', true));
  });

  it('filters items by accessory slot', async () => {
    render(<ShopScreen />);
    await waitFor(() => expect(screen.getByTestId('shop-filter-HAT')).toBeTruthy());
    expect(screen.getByText(/동그란 안경/)).toBeTruthy();

    fireEvent.press(screen.getByTestId('shop-filter-HAT'));
    expect(screen.getByText(/리본/)).toBeTruthy();
    expect(screen.queryByText(/동그란 안경/)).toBeNull();

    fireEvent.press(screen.getByTestId('shop-filter-ALL'));
    expect(screen.getByText(/동그란 안경/)).toBeTruthy();
  });

  it('shows an error with a retry button on load failure', async () => {
    (shopApi.getShopItems as jest.Mock).mockRejectedValueOnce(new Error('상점 목록을 불러오지 못했어요'));
    render(<ShopScreen />);
    await waitFor(() => expect(screen.getByTestId('shop-error')).toBeTruthy());

    fireEvent.press(screen.getByTestId('shop-retry'));
    await waitFor(() => expect(shopApi.getShopItems).toHaveBeenCalledTimes(2));
  });
});
