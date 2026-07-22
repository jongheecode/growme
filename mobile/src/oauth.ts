import { AuthRequest, ResponseType, makeRedirectUri } from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';

// Google/Kakao 둘 다 네이티브 SDK 없이 브라우저 기반 OAuth 플로우로 처리한다.
// 네이티브 SDK(특히 카카오)는 Expo Go에서 아예 로드가 안 되고 커스텀
// dev client 빌드가 필요해서, 지금 실기기 테스트 환경(Expo Go)을 깨뜨리지
// 않기 위해 일부러 피했다.

const GOOGLE_DISCOVERY = { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth' };
const KAKAO_DISCOVERY = { authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize' };

function getExtra(): { googleClientId?: string; kakaoClientId?: string } {
  return (Constants.expoConfig?.extra ?? {}) as { googleClientId?: string; kakaoClientId?: string };
}

export async function requestGoogleIdToken(): Promise<string> {
  const { googleClientId } = getExtra();
  if (!googleClientId) {
    throw new Error('구글 로그인이 아직 설정되지 않았어요');
  }
  const nonce = Crypto.randomUUID();
  const request = new AuthRequest({
    clientId: googleClientId,
    scopes: ['openid', 'profile', 'email'],
    redirectUri: makeRedirectUri(),
    responseType: ResponseType.IdToken,
    extraParams: { nonce },
  });
  const result = await request.promptAsync(GOOGLE_DISCOVERY);
  if (result.type !== 'success' || !result.params.id_token) {
    throw new Error('구글 로그인이 취소됐어요');
  }
  return result.params.id_token;
}

export async function requestKakaoAccessToken(): Promise<string> {
  const { kakaoClientId } = getExtra();
  if (!kakaoClientId) {
    throw new Error('카카오 로그인이 아직 설정되지 않았어요');
  }
  const request = new AuthRequest({
    clientId: kakaoClientId,
    redirectUri: makeRedirectUri(),
    responseType: ResponseType.Token,
  });
  const result = await request.promptAsync(KAKAO_DISCOVERY);
  if (result.type !== 'success' || !result.params.access_token) {
    throw new Error('카카오 로그인이 취소됐어요');
  }
  return result.params.access_token;
}
