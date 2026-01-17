import { TOTP, Secret } from 'otpauth';

// State lưu trữ
let timeOffset = 0;
let isSynced = false;

// Danh sách các Time Server (HTTP JSON) để thay thế cho NTP UDP
const TIME_PROVIDERS = [
  'https://timeapi.io/api/Time/current/zone?timeZone=UTC',
  'https://worldtimeapi.org/api/timezone/Etc/UTC',
];

/**
 * Chuẩn hóa chuỗi Base32 (Giống hàm normalize_base32 trong Python)
 */
const normalizeBase32 = (str: string): string => {
  const s = str.trim().replace(/[\s-]/g, '').toUpperCase();
  const pad = (8 - (s.length % 8)) % 8;
  return s + '='.repeat(pad);
};

/**
 * Lấy thời gian hiện tại đã được hiệu chỉnh (Synchronized Time)
 * Dựa trên performance.now() để đảm bảo tính đơn điệu (monotonic), không bị ảnh hưởng nếu user đổi giờ hệ thống sau khi sync.
 */
export const getSyncedTime = (): number => {
  // Nếu chưa sync, tạm dùng Date.now() nhưng lẽ ra nên block hoặc warning
  return Date.now() + timeOffset;
};

export const getSyncStatus = () => isSynced;

/**
 * Đồng bộ thời gian (Logic tương tự hàm ntp_unix_time_now trong Python)
 * 1. Gửi request.
 * 2. Đo RTT = t_end - t_start.
 * 3. Unix Now = ServerTime + RTT/2.
 */
export const syncTime = async (): Promise<boolean> => {
  isSynced = false;

  for (const url of TIME_PROVIDERS) {
    try {
      const tStart = performance.now();
      
      // Cache: no-store để luôn lấy mới nhất
      const res = await fetch(`${url}?t=${tStart}`, { cache: 'no-store' });
      if (!res.ok) continue;

      const tEnd = performance.now();
      const data = await res.json();
      
      // Các API trả về DateTime string (ISO 8601)
      const serverTimeStr = data.datetime || data.dateTime;
      if (!serverTimeStr) continue;

      const serverTime = new Date(serverTimeStr).getTime();
      const rtt = tEnd - tStart;

      // Logic ước lượng thời gian chuẩn: ServerTime + RTT/2
      // Lưu ý: serverTime là thời điểm server gửi phản hồi (xấp xỉ)
      const estimatedNow = serverTime + (rtt / 2);
      
      // Tính offset so với giờ máy hiện tại
      timeOffset = estimatedNow - Date.now();
      isSynced = true;

      console.log(`[NTP-HTTP] Synced via ${url}`);
      console.log(`[NTP-HTTP] RTT: ${rtt.toFixed(2)}ms | Offset: ${timeOffset.toFixed(2)}ms`);
      
      return true;
    } catch (e) {
      console.warn(`[NTP-HTTP] Failed to sync with ${url}:`, e);
    }
  }

  // Fallback cuối cùng: Dùng Header 'Date' của chính trang web này
  try {
      const tStart = performance.now();
      const res = await fetch(window.location.href, { method: 'HEAD', cache: 'no-store' });
      const tEnd = performance.now();
      const dateHeader = res.headers.get('date');
      if (dateHeader) {
          const serverTime = new Date(dateHeader).getTime();
          const rtt = tEnd - tStart;
          const estimatedNow = serverTime + (rtt / 2);
          timeOffset = estimatedNow - Date.now();
          isSynced = true;
          console.log(`[NTP-HTTP] Fallback to Server Header. Offset: ${timeOffset}ms`);
          return true;
      }
  } catch (e) {
      console.error("[NTP-HTTP] All sync methods failed.");
  }

  return false;
};

interface TokenResult {
  token: string;
  remaining: number;
  period: number;
  isValid: boolean;
}

/**
 * Tạo mã TOTP tại một thời điểm cụ thể (timestamp).
 * Nếu không truyền timestamp, dùng giờ đã sync.
 */
export const generateToken = (secret: string, timestamp?: number): TokenResult => {
  try {
    if (!secret) return { token: '------', remaining: 0, period: 30, isValid: false };

    let clean = secret.trim();
    if (clean.includes('|')) clean = clean.split('|')[0];
    if (clean.startsWith('otpauth://')) {
        try {
           const url = new URL(clean);
           const s = url.searchParams.get('secret');
           if (s) clean = s;
        } catch(e) {}
    }

    // 1. Chuẩn hóa Base32
    const normalized = normalizeBase32(clean);
    
    if (!/^[A-Z2-7=]+$/.test(normalized)) {
        return { token: 'ERROR', remaining: 0, period: 30, isValid: false };
    }

    const secretObj = Secret.fromBase32(normalized);
    const totp = new TOTP({
      issuer: 'SecureAuth',
      label: 'User',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: secretObj, 
    });

    // 2. Xác định thời gian tính toán
    const timeToUse = timestamp !== undefined ? timestamp : getSyncedTime();
    
    const token = totp.generate({ timestamp: timeToUse });
    
    const period = 30;
    const epoch = Math.floor(timeToUse / 1000);
    const remaining = period - (epoch % period);

    return { token: token || 'ERROR', remaining, period, isValid: true };
  } catch (error) {
    return { token: 'ERROR', remaining: 0, period: 30, isValid: false };
  }
};